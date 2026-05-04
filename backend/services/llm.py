"""Cadena de prioridad de LLMs (async): GLM → Groq (fallback).
"""

from __future__ import annotations

import os
from typing import TypedDict

from groq import AsyncGroq
from openai import AsyncOpenAI


class LLMUsage(TypedDict):
    input_tokens: int
    output_tokens: int


class LLMResult(TypedDict):
    text: str
    usage: LLMUsage
    model_used: str


_groq: AsyncGroq | None = None
_glm: AsyncOpenAI | None = None


def _get_groq() -> AsyncGroq:
    global _groq
    if _groq is None:
        _groq = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])
    return _groq


def _get_glm() -> AsyncOpenAI | None:
    """Devuelve el cliente GLM si hay key configurada."""
    global _glm
    if _glm is not None:
        return _glm
    api_key = os.environ.get("GLM_API_KEY")
    if not api_key:
        return None
    _glm = AsyncOpenAI(
        api_key=api_key,
        base_url=os.environ.get(
            "GLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4/"),
    )
    return _glm


async def generate_text(
    system_prompt: str,
    user_prompt: str,
    *,
    max_tokens: int = 1500,
    # como para un artículo mediano
    temperature: float = 0.7,
    # se usa temperature >0.7 para fomentar que el modelo use su creatividad al escribir el manual, no es un output donde queremos que sea 100% preciso, sino que tenga un tono más humano y creativo
) -> LLMResult:
    """Genera texto eligiendo automáticamente GLM o Groq.

    Si GLM está configurado pero falla (modelo inválido, rate limit, región
    bloqueada, etc.), caemos automáticamente a Groq. Esto hace el sistema
    robusto para la sustentación: aunque GLM no esté disponible en el
    entorno del evaluador, Groq SIEMPRE responde porque es el fallback gratis.
    """
    glm = _get_glm()
    if glm is not None:
        try:
            return await _with_glm(glm, system_prompt, user_prompt, max_tokens, temperature)
        except Exception as exc:
            # Loggeamos para debugging pero seguimos funcionando con Groq
            print(f"[llm] GLM failed ({type(exc).__name__}: {exc}); falling back to Groq")
    return await _with_groq(_get_groq(), system_prompt, user_prompt, max_tokens, temperature)


async def _with_glm(
    client: AsyncOpenAI,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
    temperature: float,
) -> LLMResult:
    model = os.environ.get("GLM_MODEL", "glm-4-flash")
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=max_tokens,
        temperature=temperature,
    )
    usage = response.usage
    return LLMResult(
        text=response.choices[0].message.content or "",
        usage=LLMUsage(
            input_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            output_tokens=getattr(usage, "completion_tokens", 0) or 0,
        ),
        model_used=model,
    )


async def _with_groq(
    client: AsyncGroq,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
    temperature: float,
) -> LLMResult:
    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return LLMResult(
        text=response.choices[0].message.content or "",
        usage=LLMUsage(
            input_tokens=response.usage.prompt_tokens if response.usage else 0,
            output_tokens=response.usage.completion_tokens if response.usage else 0,
        ),
        model_used=model,
    )
