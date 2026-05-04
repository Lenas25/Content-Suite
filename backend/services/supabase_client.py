"""Supabase async client singleton — un solo cliente para toda la app."""

from __future__ import annotations

import os

from supabase import AsyncClient, acreate_client

_client: AsyncClient | None = None


async def get_supabase() -> AsyncClient:
    """Retorna el cliente async de Supabase."""
    global _client
    if _client is None:
        _client = await acreate_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
    return _client
