"""Exception handlers globales para traducir errores externos a respuestas JSON limpias.

Een vez de envolver CADA endpoint con try/except (ruido + repetición), registramos handlers en la app FastAPI. Cualquier excepción que burbujee desde un servicio externo (Google AI, Groq, Supabase) cae acá y devuelve un JSON estructurado con código HTTP apropiado.
"""

from __future__ import annotations

import logging
import traceback

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger("content-suite")


def _error_response(
    status_code: int,
    detail: str,
    source: str,
    *,
    extra: dict | None = None,
) -> JSONResponse:
    body: dict = {"detail": detail, "source": source}
    if extra:
        body.update(extra)
    return JSONResponse(status_code=status_code, content=body)


def register_error_handlers(app: FastAPI) -> None:
    """Registra todos los handlers en la app. Llamar desde main.py."""

    # ───── Google GenAI (embeddings + Gemini Vision) ─────
    try:
        from google.genai import errors as genai_errors

        @app.exception_handler(genai_errors.ClientError)
        async def _genai_client_err(_req: Request, exc: genai_errors.ClientError):
            logger.warning("Google GenAI client error: %s", exc)
            msg = getattr(exc, "message", str(exc)) or str(exc)
            code = getattr(exc, "code", 400)
            return _error_response(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error de Google GenAI: {msg}",
                source="google-genai",
                extra={"upstream_code": code},
            )

        @app.exception_handler(genai_errors.ServerError)
        async def _genai_server_err(_req: Request, exc: genai_errors.ServerError):
            logger.error("Google GenAI server error: %s", exc)
            return _error_response(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google GenAI tuvo un problema. Reintenta en unos segundos.",
                source="google-genai",
            )
    except ImportError:
        pass

    # ───── Groq (fallback LLM) ─────
    try:
        from groq import APIError as GroqAPIError

        @app.exception_handler(GroqAPIError)
        async def _groq_err(_req: Request, exc: GroqAPIError):
            logger.warning("Groq API error: %s", exc)
            return _error_response(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error en Groq: {exc!s}",
                source="groq",
            )
    except ImportError:
        pass

    # ───── OpenAI client (lo usa GLM via base_url) ─────
    try:
        from openai import APIError as OpenAIAPIError

        @app.exception_handler(OpenAIAPIError)
        async def _openai_err(_req: Request, exc: OpenAIAPIError):
            logger.warning("OpenAI/GLM API error: %s", exc)
            return _error_response(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error en LLM (OpenAI-compatible): {exc!s}",
                source="openai-compatible",
            )
    except ImportError:
        pass

    # ───── Supabase / postgrest ─────
    try:
        from postgrest.exceptions import APIError as PostgrestAPIError

        @app.exception_handler(PostgrestAPIError)
        async def _postgrest_err(_req: Request, exc: PostgrestAPIError):
            logger.error("Supabase/Postgrest error: %s", exc)
            return _error_response(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error en base de datos: {exc.message if hasattr(exc, 'message') else exc!s}",
                source="supabase",
                extra={"hint": getattr(exc, "hint", None)},
            )
    except ImportError:
        pass

    # ───── Catch-all genérico ─────
    @app.exception_handler(Exception)
    async def _unhandled(_req: Request, exc: Exception):
        logger.exception("Unhandled exception: %s", exc)
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{type(exc).__name__}: {exc!s}",
            source="unhandled",
            extra={"trace": traceback.format_exc().splitlines()[-5:]},
        )
