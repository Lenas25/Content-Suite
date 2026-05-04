"""Pydantic schemas compartidos por todos los routers."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["creador", "aprobador_a", "aprobador_b"]


class LoginRequest(BaseModel):
    username: Role
    password: str


class LoginResponse(BaseModel):
    access_token: str
    role: Role
    username: Role


class CurrentUser(BaseModel):
    sub: Role
    role: Role
    exp: int = Field()


# Brand DNA


class BrandInput(BaseModel):
    """Brief que llena en el formulario"""

    product_name: str = Field(min_length=1, max_length=200)
    tone: str = Field(default="", max_length=500)
    target_audience: str = Field(default="", max_length=500)
    values: str = Field(default="", max_length=1000)
    restrictions: str = Field(default="", max_length=1000)


class BrandGenerateResponse(BaseModel):
    """Respuesta de /brand/generate markdown crudo, modelo usado."""

    manual: str = Field()
    model_used: str


class BrandSaveRequest(BrandInput):
    """Body de /brand/save agrega el manual generado al brief original."""

    manual: str = Field(min_length=1)


class BrandSaveResponse(BaseModel):
    """Respuesta de /brand/save con metadata de lo que se guardó."""
    manual_id: str
    chunks_stored: int


class BrandManualSummary(BaseModel):
    """Item de la lista en GET /brand/manuals — solo metadata, sin el markdown."""
    id: str
    product_name: str
    tone: str | None = None
    target_audience: str | None = None
    created_at: str


# Creative Engine

ContentType = Literal["descripcion_producto", "guion_video", "prompt_imagen"]
ContentStatus = Literal["pendiente", "aprobado", "rechazado"]


class ContentGenerateRequest(BaseModel):
    """Body de POST /content/generate."""

    manual_id: str = Field(min_length=1)
    content_type: ContentType
    additional_context: str = Field(default="", max_length=2000)


class RagChunkInfo(BaseModel):
    """Detalle de un chunk recuperado."""

    section_title: str
    vector_rank: int | None = None
    fts_rank: int | None = None
    rrf_score: float


class ContentGenerateResponse(BaseModel):

    content_id: str
    generated_text: str
    model_used: str
    rag_chunks_used: list[str] = Field()
    rag_detail: list[RagChunkInfo] = Field()
    status: ContentStatus = "pendiente"


class ContentItem(BaseModel):
    """Fila de la tabla content_items"""

    id: str
    manual_id: str
    content_type: ContentType
    additional_context: str | None = None
    generated_text: str
    status: ContentStatus
    rejection_reason: str | None = None
    audit_result: dict | None = None
    created_at: str
    updated_at: str


class ContentStatusUpdate(BaseModel):
    """Body de PATCH /content/{id}/status aprueba o rechaza texto."""

    status: ContentStatus
    rejection_reason: str | None = Field(default=None, max_length=1000)


# Multimodal Audit

AuditCategory = Literal[
    "uso_logo",
    "colores_estilo",
    "publico_representado",
    "temas_sensibles",
    "claims_implicitos",
]

AuditSeverity = Literal["low", "medium", "high"]


class AuditCheck(BaseModel):
    """Una regla individual evaluada sobre la imagen."""

    category: AuditCategory
    rule: str = Field()
    passed: bool
    severity: AuditSeverity
    detail: str = Field()


class AuditResult(BaseModel):
    """Salida de Gemini Vision al auditar una imagen sobre el manual."""

    passed: bool
    overall_comment: str
    checks: list[AuditCheck]


class AuditLog(BaseModel):
    """Fila de la tabla audit_logs — historial de todas las auditorías."""

    id: str
    manual_id: str | None = None
    content_id: str | None = None
    image_filename: str | None = None
    audited_by: str
    passed: bool
    result: AuditResult
    created_at: str
