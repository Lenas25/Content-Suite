"""Gemini Vision async donde se da la auditoría multimodal de imágenes contra el manual.

Usamos el SDK `google-genai` con structured output:
- `response_mime_type='application/json'` fuerza JSON válido.
- `response_schema=AuditResult` le dicta a Gemini el shape exacto.
"""

from __future__ import annotations

import json
import os

from google.genai import types as genai_types

from models.schemas import AuditResult
from services.google_client import get_genai_client

# gemini-2.0-flash devuelve 429 con limit: 0 en algunas regiones (incl. LATAM).
# gemini-2.5-flash-lite es multimodal, tiene free tier estable, y sirve para
# auditoría visual con buena precisión.
VISION_MODEL = os.environ.get("VISION_MODEL", "gemini-2.5-flash-lite")


def _build_audit_prompt(brand_manual_context: str) -> str:
    return f"""Eres un auditor de identidad de marca experto que evalúa imágenes
contra un manual de marca oficial.

Vas a recibir:
1) Fragmentos relevantes de un MANUAL DE MARCA.
2) Una IMAGEN de una pieza de comunicación (pack, banner, anuncio, etc.).

MANUAL DE MARCA (TEXTO):
---
{brand_manual_context}
---

Instrucciones:
- Analiza la imagen ÚNICAMENTE en función de las reglas, ejemplos y restricciones del manual.
- No uses conocimiento externo sobre la marca ni sobre buenas prácticas genéricas.
- Evalúa como mínimo estas dimensiones (aunque el manual las mencione de forma implícita):

  1. uso_logo:
     - presencia y visibilidad del logo;
     - tamaño relativo y ubicación;
     - respeto de zona de seguridad y contraste con el fondo.

  2. colores_estilo:
     - alineación general con la paleta y el estilo visual definidos en el manual;
     - coherencia con los conceptos de la marca (natural, premium, Gen Z, etc.).

  3. publico_representado:
     - grupos de edad, diversidad y situaciones de uso;
     - cumplimiento de restricciones sobre menores, contextos de consumo, etc.

  4. temas_sensibles:
     - salud, cuerpos, sexualización, violencia, discriminación u otros temas sensibles
       que el manual mencione;
     - evita imágenes que refuercen estereotipos o comportamientos no saludables
       si el manual lo prohíbe.

  5. claims_implicitos:
     - beneficios de salud, rendimiento o pérdida de peso que la imagen sugiera,
       incluso si no aparecen como texto;
     - identifica si estos claims están permitidos o prohibidos según el manual.

- Identifica tanto cumplimientos como incumplimientos.
- Si detectas al menos una violación importante (severity "high" o "medium"), marca "passed" en false.
- Si una dimensión no aplica a la imagen o no hay información suficiente en el manual,
  marca passed=true con severity="low" y explícalo en `detail`.
- En cada check, en `rule`, resume la regla del manual que estás evaluando,
  y en `detail` cita textualmente la parte relevante del manual y describe por qué pasa o falla.

Severity:
- "low"    → observación menor o matiz estilístico.
- "medium" → incumplimiento de guideline relevante del manual.
- "high"   → incumplimiento de una restricción estricta o riesgo significativo para la marca."""


async def audit_image_with_gemini(
    image_bytes: bytes,
    brand_manual_context: str,
    *,
    mime_type: str = "image/jpeg",
) -> AuditResult:
    """Audita una imagen contra el manual."""
    client = get_genai_client()

    # Pasar la imagen como un Part con su MIME type para que Gemini lo procese correctamente en bytes.
    image_part = genai_types.Part.from_bytes(
        data=image_bytes, mime_type=mime_type)
    prompt_text = _build_audit_prompt(brand_manual_context)

    response = await client.aio.models.generate_content(
        model=VISION_MODEL,
        contents=[prompt_text, image_part],
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=AuditResult,
            temperature=0.2,  # queremos consistencia, no creatividad, más cercano a "determinista" 0
        ),
    )

    parsed = response.parsed
    if isinstance(parsed, AuditResult):
        return parsed

    # Si el SDK no parsea, validamos a mano.
    return AuditResult.model_validate(json.loads(response.text))
