"""Módulo I — Brand DNA Architect

Endpoints:
- POST /brand/generate  → genera el manual de marca en markdown.
- POST /brand/save      → guarda manual + chunks vectoriales (RAG).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from langfuse import get_client, observe

from models.schemas import (
    BrandGenerateResponse,
    BrandInput,
    BrandManualSummary,
    BrandSaveRequest,
    BrandSaveResponse,
    CurrentUser,
)
from routers.auth import get_current_user
from services.llm import generate_text
from services.rag import save_manual_to_rag
from services.supabase_client import get_supabase

router = APIRouter(prefix="/brand", tags=["brand"])


BRAND_SYSTEM_PROMPT = """Eres un estratega senior de marca y redactor especializado en crear
manuales de identidad de marca claros, accionables y listos para ser usados por otros sistemas de IA.

Reglas generales:
- Redacta siempre en español neutro, claro y profesional.
- Usa un tono alineado con la personalidad que defina el brief (serio, divertido, aspiracional, Gen Z, etc.).
- No inventes datos del producto: usa únicamente la información que aparezca en el brief del usuario.
- Evita clichés vacíos de marketing (“revolucionar tu vida”, “cambiarlo todo”) salvo que el manual los autorice explícitamente.
- Estructura SIEMPRE la salida en un manual en formato markdown, usando ## para cada sección de primer nivel.
- Cada sección debe incluir ejemplos concretos, listas de DOs/DON’Ts y reglas accionables, no descripciones vagas.
- Recuerda que este manual será consumido después por otros modelos (texto y visión)
  para validar contenidos y piezas gráficas; las restricciones deben ser evaluables de forma automática.
- Si falta información crítica en el brief, indícalo en una sección final "## Suposiciones"
  en lugar de inventar.

Secciones obligatorias (en este orden, usando ## tal cual):

## Resumen de Marca
Explica en 1–2 párrafos qué es el producto, en qué contexto se consume,
qué beneficio funcional aporta y qué beneficio emocional promete.
No dupliques literalmente el texto del brief: sintetiza y organiza.

## Personalidad y Voz
Describe la personalidad de la marca (3–5 adjetivos) y cómo se traduce en lenguaje.
Incluye una lista "Somos / No somos" con al menos 3 ítems por lado.
Añade 2–3 ejemplos de frases que SÍ diría la marca y 2–3 que NO diría.

## Público Objetivo
Define el público objetivo de forma concreta: edad, contexto (estudiantes, primeros empleos, familias, etc.),
entorno (urbano/rural), motivaciones y tensiones que resuelve el producto.
Evita definiciones genéricas tipo “jóvenes modernos”.

## Pilares de Mensaje
Enumera 3–5 pilares de mensaje clave (por ejemplo: salud accesible, autenticidad, sustentabilidad, practicidad).
Para cada pilar:
- describe qué significa en esta marca;
- da 1–2 ejemplos de claims o mensajes que lo expresen.

## Tono y Estilo de Lenguaje
Especifica reglas prácticas de tono:
- longitud típica de frases;
- uso de “tú” o “usted”;
- nivel de formalidad;
- uso permitido de humor, emoticonos o slang.
Incluye al menos 3 DOs y 3 DON’Ts específicos de estilo.

## Palabras y Recursos Permitidos
Crea listas de vocabulario, campos semánticos y recursos visuales recomendados:
- Palabras clave alineadas con los valores de marca.
- Expresiones que refuercen el posicionamiento (ejemplos de frases cortas).
- Tipos de imágenes y situaciones que SÍ son adecuadas.

## Palabras y Recursos Prohibidos
Crea listas de palabras, expresiones y recursos visuales que se deben evitar:
- Términos relacionados con dietas, culpa, estándares de belleza u otras sensibilidades que el brief prohíba.
- Ejemplos de frases problemáticas.
- Tipos de imágenes, símbolos o contextos que NO se deben usar.
Sé explícito: incluye sinónimos y variantes típicas que convenga bloquear.

## Ejemplos de Mensajes On-brand
Incluye al menos 3 ejemplos on-brand:
- 1 ejemplo de texto para ficha de e‑commerce.
- 1 ejemplo de post de redes sociales.
- 1 ejemplo opcional para empaque o pieza más institucional.
Cada ejemplo debe respetar el tono definido y los pilares de mensaje.

## Ejemplos de Mensajes Off-brand
Incluye al menos 3 ejemplos off-brand que muestren errores típicos:
- uso de claims no permitidos;
- tono inadecuado (demasiado solemne, demasiado chistoso, culpabilizador, etc.);
- vocabulario prohibido.
Aclara brevemente por qué cada ejemplo es off-brand.

## Restricciones Estrictas
Redacta las restricciones de forma evaluable y divídelas en subapartados:
- Restricciones de lenguaje: palabras y claims que nunca se pueden usar.
- Restricciones visuales: qué no se puede mostrar en imágenes o videos
  (por ejemplo, menores de cierta edad, contextos prohibidos, símbolos sensibles).
Utiliza frases en formato de regla clara, por ejemplo:
" Nunca mostrar menores de 18 años consumiendo el producto en piezas de marketing."
" No utilizar claims de salud no comprobados o exagerados."
"""


def _build_user_prompt(body: BrandInput) -> str:
    return f"""Crea un manual de marca completo para el siguiente producto:

- Nombre del producto: "{body.product_name}"
- Tono deseado: "{body.tone}"
- Público objetivo: "{body.target_audience}"
- Valores de marca: "{body.values}"
- Restricciones estrictas: "{body.restrictions}"

Instrucciones de salida:
- Sigue la estructura y el orden de secciones indicados en el mensaje del sistema.
- Asegúrate de que las secciones de "## Tono y Estilo de Lenguaje",
  "## Palabras y Recursos Prohibidos" y "## Restricciones Estrictas"
  sean muy explícitas y redactadas como reglas evaluables.
- En "## Ejemplos de Mensajes On-brand" y "## Ejemplos de Mensajes Off-brand"
  incluye ejemplos pensados para canales distintos (por ejemplo, redes sociales y ficha de e‑commerce),
  respetando siempre las restricciones indicadas en el brief."""


@router.post("/generate", response_model=BrandGenerateResponse)
@observe(name="brand-dna-generate")
async def generate_brand_manual(
    body: BrandInput,
    user: CurrentUser = Depends(get_current_user),
) -> BrandGenerateResponse:
    langfuse = get_client()
    langfuse.update_current_span(
        input=body.model_dump(),
        metadata={"user_id": user.sub,
                  "product": body.product_name, "module": "brand-dna"},
    )

    user_prompt = _build_user_prompt(body)
    result = await generate_text(BRAND_SYSTEM_PROMPT, user_prompt, max_tokens=2500)

    langfuse.update_current_span(
        output={"model_used": result["model_used"],
                "preview": result["text"][:200]},
    )
    return BrandGenerateResponse(manual=result["text"], model_used=result["model_used"])


@router.post("/save", response_model=BrandSaveResponse)
@observe(name="brand-dna-save-rag")
async def save_brand_manual(
    body: BrandSaveRequest,
    user: CurrentUser = Depends(get_current_user),
) -> BrandSaveResponse:
    langfuse = get_client()
    langfuse.update_current_span(
        metadata={"user_id": user.sub,
                  "product": body.product_name, "module": "brand-dna"},
    )

    supabase = await get_supabase()
    insert_result = await supabase.table("brand_manuals").insert(
        {
            "product_name": body.product_name,
            "tone": body.tone,
            "target_audience": body.target_audience,
            "values": body.values,
            "restrictions": body.restrictions,
            "raw_manual": body.manual,
        }
    ).execute()
    manual_id = insert_result.data[0]["id"]

    chunks_stored = await _index_rag(manual_id, body.manual)

    langfuse.update_current_span(
        output={"manual_id": manual_id, "chunks_stored": chunks_stored},
    )
    return BrandSaveResponse(manual_id=manual_id, chunks_stored=chunks_stored)


@router.get("/manuals", response_model=list[BrandManualSummary])
async def list_brand_manuals(
    _user: CurrentUser = Depends(get_current_user),
) -> list[BrandManualSummary]:
    """Lista todos los manuales de marca disponibles. Cualquier rol autenticado puede consultar.

    Devuelve solo metadata (sin el markdown completo) — pensado para selectores
    de UI en Creative Engine y Visual Audit.
    """
    supabase = await get_supabase()
    result = await (
        supabase.table("brand_manuals")
        .select("id, product_name, tone, target_audience, created_at")
        .order("created_at", desc=True)
        .execute()
    )
    return [BrandManualSummary(**row) for row in (result.data or [])]


@observe(name="rag-indexing")
async def _index_rag(manual_id: str, manual_text: str) -> int:
    """Observando para que el span de indexación aparezca anidado en Langfuse."""
    return await save_manual_to_rag(manual_id, manual_text)
