"""Google GenAI async client singleton (SDK nuevo `google-genai`)."""

from __future__ import annotations

import os

from google import genai

_client: genai.Client | None = None


def get_genai_client() -> genai.Client:
    """Cliente Google GenAI. Se usa para embeddings y Gemini Vision."""
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    return _client
