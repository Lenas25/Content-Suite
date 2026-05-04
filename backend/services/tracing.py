"""Langfuse v3 tracing wrapper.

Para inicializar el cliente al importar y de exponer un helper opcional.
"""

from __future__ import annotations

import os

from langfuse import Langfuse, get_client

_langfuse: Langfuse | None = None


def init_langfuse() -> Langfuse:
    """Inicializa Langfuse leyendo el .env."""
    global _langfuse
    if _langfuse is not None:
        return _langfuse

    _langfuse = Langfuse(
        secret_key=os.environ["LANGFUSE_SECRET_KEY"],
        public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
        host=os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"),
    )
    return _langfuse


def get_tracer() -> Langfuse:
    """Devuelve el cliente Langfuse."""
    return get_client()
