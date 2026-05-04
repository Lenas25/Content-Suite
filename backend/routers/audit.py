"""Módulo III — Multimodal Audit.

Endpoint:
- POST /audit/image  → sube una imagen y la audita contra el manual.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from langfuse import get_client, observe

from models.schemas import AuditLog, AuditResult, CurrentUser
from routers.auth import require_role
from services.rag import retrieve_context
from services.supabase_client import get_supabase
from services.vision import audit_image_with_gemini

router = APIRouter(prefix="/audit", tags=["audit"])


# Query semántica diseñada para que el hybrid search traiga las secciones
# que realmente importan al evaluar una imagen. Mezcla keywords (BM25) +
# conceptos (vector) → RRF garantiza buena cobertura.
AUDIT_RAG_QUERY = (
    "restricciones visuales tono logo colores paleta público objetivo "
    "temas sensibles claims prohibidos identidad de marca"
)


@router.post("/image", response_model=AuditResult)
@observe(name="multimodal-audit")
async def audit_image(
    manual_id: str = Form(..., description="ID del manual de marca contra el que se audita"),
    image: UploadFile = File(..., description="Imagen a auditar (jpeg/png/webp)"),
    content_id: str | None = Form(
        default=None,
        description="OPCIONAL — si se pasa, vincula el resultado a un content_item existente",
    ),
    user: CurrentUser = Depends(require_role("aprobador_b")),
) -> AuditResult:
    """Audita una imagen contra el manual de marca usando Gemini Vision.

    El reto Alicorp pide: 'el Aprobador B sube una imagen y el sistema la contrasta
    contra el manual de marca'. La auditoría es independiente del flujo de
    aprobación de texto — `content_id` es opcional; si se pasa, además vincula
    el resultado al content_item para auditoría de pieza ya generada.
    """
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser una imagen (image/jpeg, image/png, image/webp).",
        )

    langfuse = get_client()
    langfuse.update_current_span(
        metadata={
            "user_id": user.sub,
            "module": "governance-audit",
            "manual_id": manual_id,
            "content_id": content_id,
            "image_mime": image.content_type,
            "image_filename": image.filename,
        },
    )

    # 1. Hybrid RAG: traer secciones relevantes del manual
    chunks = await _retrieve_for_audit(query=AUDIT_RAG_QUERY, manual_id=manual_id)
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró contexto en el manual indicado.",
        )
    brand_context = "\n\n".join(
        f"[{c['section_title']}]\n{c['chunk_text']}" for c in chunks
    )

    # 2. Gemini Vision audita la imagen
    image_bytes = await image.read()
    audit_result = await _gemini_audit(
        image_bytes=image_bytes,
        brand_context=brand_context,
        mime_type=image.content_type,
    )

    supabase = await get_supabase()

    # 3. Siempre persistir en audit_logs (historial independiente)
    await (
        supabase.table("audit_logs")
        .insert(
            {
                "manual_id": manual_id,
                "content_id": content_id,
                "image_filename": image.filename,
                "audited_by": user.sub,
                "passed": audit_result.passed,
                "result": audit_result.model_dump(),
            }
        )
        .execute()
    )

    # 4. (Opcional) Actualizar content_items si se vinculó a contenido existente
    if content_id:
        new_status = "aprobado" if audit_result.passed else "rechazado"
        await (
            supabase.table("content_items")
            .update(
                {
                    "audit_result": audit_result.model_dump(),
                    "status": new_status,
                }
            )
            .eq("id", content_id)
            .execute()
        )

    langfuse.update_current_span(
        output={
            "passed": audit_result.passed,
            "checks_count": len(audit_result.checks),
            "linked_to_content": content_id is not None,
        },
    )
    return audit_result


@router.get("/logs", response_model=list[AuditLog])
async def list_audit_logs(
    limit: int = 50,
    user: CurrentUser = Depends(require_role("aprobador_b")),
) -> list[AuditLog]:
    """Lista el historial completo de auditorías de imagen, ordenado por fecha descendente."""
    supabase = await get_supabase()
    result = await (
        supabase.table("audit_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [AuditLog(**row) for row in (result.data or [])]


@observe(name="hybrid-rag-for-audit")
async def _retrieve_for_audit(query: str, manual_id: str) -> list[dict]:
    """Observando el span anidado para ver en Langfuse qué chunks fueron al auditor."""
    chunks = await retrieve_context(query, manual_id, k=4)
    langfuse = get_client()
    langfuse.update_current_span(
        input={"query": query, "manual_id": manual_id},
        output={
            "chunks_retrieved": len(chunks),
            "sections": [c["section_title"] for c in chunks],
        },
    )
    return chunks


@observe(name="gemini-vision-audit", as_type="generation")
async def _gemini_audit(
    image_bytes: bytes,
    brand_context: str,
    mime_type: str,
) -> AuditResult:
    """Observando para que la llamada a Gemini aparezca como generation en Langfuse."""
    result = await audit_image_with_gemini(image_bytes, brand_context, mime_type=mime_type)
    langfuse = get_client()
    langfuse.update_current_generation(
        input={
            "context_preview": brand_context[:300],
            "image_bytes": len(image_bytes),
            "mime_type": mime_type,
        },
        output=result.model_dump(),
        model=os.environ.get("VISION_MODEL", "gemini-2.5-flash-lite"),
    )
    return result
