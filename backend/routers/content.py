"""Módulo II — Creative Engine.

Endpoints:
- POST   /content/generate     → genera contenido con hybrid RAG.
- GET    /content              → lista filtrable.
- GET    /content/{id}         → un item por ID.
- PATCH  /content/{id}/status  → Aprobador A aprueba o rechaza texto.

El system prompt se construye inyectando los chunks obtenidos en búsqueda como única fuente de verdad.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from langfuse import get_client, observe

from models.schemas import (
    ContentGenerateRequest,
    ContentGenerateResponse,
    ContentItem,
    ContentStatus,
    ContentStatusUpdate,
    ContentType,
    CurrentUser,
    RagChunkInfo,
)
from routers.auth import get_current_user, require_role
from services.llm import generate_text
from services.rag import retrieve_context
from services.supabase_client import get_supabase

router = APIRouter(prefix="/content", tags=["content"])


CONTENT_SYSTEM_PROMPT_TEMPLATE = """Eres un redactor creativo senior de marketing especializado en escribir \
contenidos que respetan estrictamente un manual de marca dado.

CONTEXTO DE MARCA (NO LO REPITAS TAL CUAL EN LA SALIDA)
---
{context_text}
---
FIN DEL CONTEXTO

PRODUCTO: {product_name}

Reglas de generación (NO NEGOCIABLES):
- Tu única fuente de verdad sobre la marca es el contexto anterior.
- Usa el nombre exacto del PRODUCTO ("{product_name}") al menos una vez en el contenido.
- Imita el tono que dicte el contexto. Si el manual pide tono divertido/casual/Gen Z, \
usa ese registro: frases cortas, lenguaje directo y, solo si encajan, modismos coloquiales.
- NO contradigas ninguna regla, restricción ni ejemplo del manual.
- Si el contexto entra en conflicto, priorizá la sección "Restricciones Estrictas".
- Redactá en español neutro.
- NO inventes beneficios médicos/legales/de performance si no están en el contexto.
- NO agregues notas legales, disclaimers, "Nota de cumplimiento", o explicaciones sobre cómo \
respetaste el manual al final del texto. Devolvé EXCLUSIVAMENTE el contenido pedido, sin meta-comentarios."""


TYPE_INSTRUCTIONS: dict[ContentType, str] = {
    "descripcion_producto": """Escribí una descripción de producto para e-commerce de \
aproximadamente 100 palabras (entre 80 y 120) en EXACTAMENTE 2 párrafos. \
Mencioná el nombre del producto 2 veces. Terminá con un call-to-action breve. \
Prohibido empezar con: "Descubre", "En el corazón de", "Somos", "Te presentamos".

A continuación tenés DOS ejemplos con tonos DELIBERADAMENTE OPUESTOS para que entiendas \
que el TONO de tu salida lo dicta el MANUAL DE MARCA del contexto — NO los ejemplos. \
De los ejemplos copiá únicamente la ESTRUCTURA (2 párrafos, ~100 palabras, hook + qué \
es + diferenciador + CTA) y la DENSIDAD informativa. El registro lingüístico (formal, \
casual, técnico, irreverente, etc.) lo decidís leyendo el manual, no los ejemplos.

═══ EJEMPLO 1 — Manual con tono formal/premium ═══
Inputs: product_name "Aurelia Chronograph" · tono "elegante, sobrio, exclusivo" · público "ejecutivos 35-50"

Salida:
Aurelia Chronograph reinterpreta la herencia relojera suiza para quienes valoran la \
precisión sin estridencias. Calibre automático con reserva de marcha de 72 horas, caja \
de acero satinado de 41 mm y zafiro antirreflectante: cada componente responde a un \
estándar de manufactura artesanal verificable. Aurelia Chronograph no busca llamar la \
atención; busca durar.

Para quien entiende que el tiempo bien medido es la única ostentación necesaria. \
Disponible en correa de cuero italiano cosido a mano. Solicite asesoramiento.

═══ EJEMPLO 2 — Manual con tono casual/Gen Z ═══
Inputs: product_name "VibeBeans" · tono "fresco, irreverente, Gen Z" · público "estudiantes 18-25"

Salida:
VibeBeans no es café, es plan. Granos de altura tostados acá nomás, molidos para que \
te dure el shot del lunes a la prueba del jueves sin que la cocina huela a nafta. Cero \
químicos raros, cero discurso de yoga. Solo café que despierta sin pedir permiso.

Lo que hace a VibeBeans distinto: viene en paquete que sí cierra (sí, eso ya es noticia) \
y sabe igual el día 1 que el día 21. Probá una bolsa.

═══ FIN DE EJEMPLOS ═══

Notá que la ESTRUCTURA es idéntica en ambos (~100 palabras, 2 párrafos, hook punzante, \
diferenciador concreto, CTA breve) pero el TONO cambia radicalmente porque cada uno \
respeta su manual. Hacé lo mismo con el manual del contexto que recibiste.

No repitas nombres de productos ni frases completas de los ejemplos; \
solo copia la estructura y la densidad informativa.
""",

    "guion_video": """Escribí un guión de video de 30 segundos. Formato escena por escena \
con etiquetas "ESCENA 1:", "ESCENA 2:", etc. Cada escena incluye tiempo, descripción \
visual y voz en off (VO). Máximo 4 escenas, total ~200 palabras. Mencioná el producto \
al menos 1 vez. El tono lo define el manual del contexto, NO los ejemplos.

A continuación DOS ejemplos con tonos OPUESTOS. Copiá la ESTRUCTURA (4 escenas, \
timestamps, Visual + VO por escena, escena 4 con pack shot + tagline). El registro \
lingüístico de la VO lo decidís según el manual de marca.

═══ EJEMPLO 1 — Manual con tono institucional/serio ═══
Inputs: product_name "MeridianBank Pro" · tono "confiable, profesional, sobrio"

ESCENA 1 (0-5s):
Visual: Mujer ejecutiva en oficina con vista a la ciudad, revisa portafolio digital.
VO: "Tomar decisiones financieras requiere claridad."

ESCENA 2 (5-15s):
Visual: Pantalla del celular con interfaz limpia de MeridianBank Pro mostrando datos.
VO: "MeridianBank Pro consolida tus inversiones en un solo lugar, con la precisión \
que tu portafolio exige."

ESCENA 3 (15-25s):
Visual: Reunión con asesor, cliente asiente con confianza.
VO: "Asesoría especializada y herramientas institucionales, ahora en tu bolsillo."

ESCENA 4 (25-30s):
Visual: Logo MeridianBank Pro sobre fondo neutro.
VO: "MeridianBank Pro. La confianza tiene una nueva forma."

═══ EJEMPLO 2 — Manual con tono casual/divertido ═══
Inputs: product_name "ZapPay" · tono "joven, irreverente, directo"

ESCENA 1 (0-5s):
Visual: Pibe en una pizzería divide la cuenta en su celu, cara de "esto es magia".
VO: "Pagar entre amigos, sin Excel."

ESCENA 2 (5-15s):
Visual: Pantalla con interfaz ZapPay, tres avatares se reparten un costo en 2 toques.
VO: "ZapPay divide la cuenta en serio. Sin códigos, sin números de cuenta, sin drama."

ESCENA 3 (15-25s):
Visual: El grupo brindando, cada uno chequea su celu satisfecho.
VO: "Lo que tarda en llegar la pizza, tarda en saldarse la deuda."

ESCENA 4 (25-30s):
Visual: Logo ZapPay con un rayito.
VO: "ZapPay. Cero vueltas."

═══ FIN ═══

Generá el guión para el producto del contexto, copiando la estructura y respetando \
el tono que dicta el manual.

No repitas nombres de productos ni frases completas de los ejemplos; \
solo copia la estructura y la densidad informativa.
""",

    "prompt_imagen": """Escribí un prompt detallado para un generador de imágenes IA. \
Formato lista de campos separados por línea, NO párrafos narrativos. Máximo 100 palabras totales. \
La paleta, mood y estilo visual los DECIDÍS leyendo el manual de marca del contexto, \
no los del ejemplo.

ESTRUCTURA de campos a respetar (los valores del ejemplo son ilustrativos, no copies su estética):

Encuadre: <medium shot / wide / close-up / overhead / etc.>
Sujeto: <descripción concreta del sujeto principal incluyendo el producto si aplica>
Estilo: <fotografía editorial / 3D render / ilustración / cinematográfico / etc.>
Paleta: <colores específicos del manual; sin saturación si el manual lo prohíbe>
Iluminación: <natural / estudio / dramática / suave; mood lighting>
Mood: <aspiracional / íntimo / dinámico / sereno / etc.>
Restricciones: <qué NO debe aparecer según el manual: logos prohibidos, fondos, \
elementos sensibles, paleta vetada, contextos no permitidos>

EJEMPLO ilustrativo (NO copies estos valores, solo la forma de cada línea):

Encuadre: medium shot, eye-level, rule of thirds.
Sujeto: Persona joven sosteniendo el producto en contexto urbano cotidiano.
Estilo: fotografía lifestyle natural, look editorial limpio.
Paleta: tonos definidos por el manual (no inventar colores ajenos a la marca).
Iluminación: luz natural cálida, sombras suaves, sin flashes duros.
Mood: aspiracional pero accesible.
Restricciones: NO logos de competidores, NO ambientes que el manual prohíba, \
NO claims visuales que el manual no permita.

Ahora generá el prompt para el producto del contexto, llenando cada campo con \
valores que respeten el manual de marca específico.

No repitas nombres de productos ni frases completas de los ejemplos; \
solo copia la estructura y la densidad informativa.""",
}


@router.post("/generate", response_model=ContentGenerateResponse)
@observe(name="content-generate")
async def generate_content(
    body: ContentGenerateRequest,
    user: CurrentUser = Depends(get_current_user),
) -> ContentGenerateResponse:
    langfuse = get_client()
    langfuse.update_current_span(
        input=body.model_dump(),
        metadata={
            "user_id": user.sub,
            "module": "creative-engine",
            "type": body.content_type,
            "manual_id": body.manual_id,
        },
    )

    # 1. Resolver el product_name desde brand_manuals (lo necesita el prompt)
    supabase = await get_supabase()
    manual_row = await (
        supabase.table("brand_manuals")
        .select("product_name")
        .eq("id", body.manual_id)
        .single()
        .execute()
    )
    if not manual_row.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="manual_id no existe.",
        )
    product_name = manual_row.data["product_name"]

    # 2. Hybrid retrieval — DOS queries separadas:
    #    - embed_query (vector): keywords + producto + contexto libre del usuario.
    #      El modelo de embeddings aprovecha el lenguaje natural completo.
    #    - fts_keywords (BM25): SOLO keywords curados que sabemos están en el manual.
    #      Limpio, sin guiones ni inglés, sin texto del usuario que pueda romper el match.
    base_keywords = "identidad marca pilares mensaje público objetivo tono voz restricciones"
    if body.content_type == "prompt_imagen":
        extra_keywords = "restricciones visuales imágenes logos colores contextos prohibidos"
    elif body.content_type == "guion_video":
        extra_keywords = "escenas video visual restricciones audiovisual"
    else:
        extra_keywords = "ficha producto descripción ejemplos texto"

    fts_keywords = f"{base_keywords} {extra_keywords} {product_name}"
    embed_query = f"{fts_keywords} {body.additional_context}".strip()

    retrieved = await _retrieve_for_generation(
        query=embed_query,
        fts_keywords=fts_keywords,
        manual_id=body.manual_id,
    )
    if not retrieved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró contexto en el manual indicado.",
        )

    # 3. System prompt con contexto + producto inyectados
    context_text = "\n\n".join(
        f"[{c['section_title']}]\n{c['chunk_text']}" for c in retrieved
    )
    system_prompt = CONTENT_SYSTEM_PROMPT_TEMPLATE.format(
        context_text=context_text,
        product_name=product_name,
    )

    user_msg = f"""Tipo de contenido a generar: "{body.content_type}".
Producto: "{product_name}"

Contexto adicional del usuario (campaña / canal / objetivo):
"{body.additional_context}"

Instrucción de salida:
{TYPE_INSTRUCTIONS[body.content_type]}

Devolvé SOLO el contenido pedido. Sin notas, sin disclaimers, sin meta-comentarios."""

    # 4. Generar — max_tokens y temperature ajustados al tipo de pieza
    # Descripciones e-commerce → temperature baja (precisión > creatividad)
    # Guiones y prompts de imagen → temperature media (más creatividad)
    temperature = 0.4 if body.content_type == "descripcion_producto" else 0.7
    result = await generate_text(
        system_prompt, user_msg, max_tokens=700, temperature=temperature
    )

    # 5. Persistir
    insert_result = await supabase.table("content_items").insert(
        {
            "manual_id": body.manual_id,
            "content_type": body.content_type,
            "additional_context": body.additional_context,
            "generated_text": result["text"],
            "status": "pendiente",
        }
    ).execute()
    content_id = insert_result.data[0]["id"]

    # Crear la respiesta detallada
    rag_detail = [
        RagChunkInfo(
            section_title=c["section_title"],
            vector_rank=c.get("vector_rank"),
            fts_rank=c.get("fts_rank"),
            rrf_score=round(float(c.get("rrf_score") or 0), 4),
        )
        for c in retrieved
    ]

    # Respuesta con metadata completa para observabilidad y uso en frontend
    response = ContentGenerateResponse(
        content_id=content_id,
        generated_text=result["text"],
        model_used=result["model_used"],
        rag_chunks_used=[c["section_title"] for c in retrieved],
        rag_detail=rag_detail,
        status="pendiente",
    )

    langfuse.update_current_span(
        output={
            "content_id": content_id,
            "model_used": result["model_used"],
            "rag_chunks": response.rag_chunks_used,
        },
    )
    return response


@observe(name="hybrid-rag-retrieval")
async def _retrieve_for_generation(
    query: str,
    manual_id: str,
    *,
    fts_keywords: str | None = None,
) -> list[dict]:
    """Observando para que el span queda anidado dentro de content-generate en Langfuse."""
    chunks = await retrieve_context(
        query, manual_id, fts_keywords=fts_keywords, k=4
    )
    langfuse = get_client()
    langfuse.update_current_span(
        input={
            "query": query,
            "fts_keywords": fts_keywords,
            "manual_id": manual_id,
        },
        output={
            "chunks_retrieved": len(chunks),
            "chunks": [
                {
                    "section": c["section_title"],
                    "vector_rank": c.get("vector_rank"),
                    "fts_rank": c.get("fts_rank"),
                    "rrf_score": round(float(c.get("rrf_score") or 0), 4),
                }
                for c in chunks
            ],
        },
    )
    return chunks


@router.get("", response_model=list[ContentItem])
async def list_content(
    status_filter: ContentStatus | None = Query(default=None, alias="status"),
    manual_id: str | None = Query(default=None),
    content_type: ContentType | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    _user: CurrentUser = Depends(get_current_user),
) -> list[ContentItem]:
    """Lista con filtros. Cualquier rol autenticado puede consultar."""
    supabase = await get_supabase()
    query_builder = (
        supabase.table("content_items").select(
            "*").order("created_at", desc=True).limit(limit)
    )
    if status_filter:
        query_builder = query_builder.eq("status", status_filter)
    if manual_id:
        query_builder = query_builder.eq("manual_id", manual_id)
    if content_type:
        query_builder = query_builder.eq("content_type", content_type)

    result = await query_builder.execute()
    return [ContentItem(**row) for row in (result.data or [])]


@router.get("/{content_id}", response_model=ContentItem)
async def get_content(
    content_id: str,
    _user: CurrentUser = Depends(get_current_user),
) -> ContentItem:
    supabase = await get_supabase()
    result = await supabase.table("content_items").select("*").eq("id", content_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Contenido no encontrado")
    return ContentItem(**result.data)


# Se aplico RBAC solo los aprobadores pueden cambiar el status del contenido, pero cualquier usuario autenticado puede generar y consultar contenido.
@router.patch("/{content_id}/status", response_model=ContentItem)
@observe(name="content-status-change")
async def update_content_status(
    content_id: str,
    body: ContentStatusUpdate,
    user: CurrentUser = Depends(require_role("aprobador_a", "aprobador_b")),
) -> ContentItem:
    """Aprobador A (texto) o B (visual) cambia el status del contenido."""
    if body.status == "rechazado" and not body.rejection_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="rejection_reason es obligatorio al rechazar",
        )

    langfuse = get_client()
    langfuse.update_current_span(
        input=body.model_dump(),
        metadata={
            "user_id": user.sub,
            "content_id": content_id,
            "new_status": body.status,
        },
    )

    supabase = await get_supabase()
    update_payload: dict = {"status": body.status}
    if body.status == "rechazado":
        update_payload["rejection_reason"] = body.rejection_reason

    result = await (
        supabase.table("content_items")
        .update(update_payload)
        .eq("id", content_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Contenido no encontrado")

    return ContentItem(**result.data[0])
