"""RAG híbrido (vector + BM25) async

- Embeddings: Google `text-embedding-004` (dim=768) vía SDK `google-genai` con cliente async (`client.aio.models.embed_content`).
- Búsqueda: hybrid search vía RPC `hybrid_search_brand` (RRF en SQL).
- Chunking: respeta secciones markdown (líneas que empiezan con '##').
"""

from __future__ import annotations

import asyncio
from typing import Any

from google.genai import types as genai_types

from services.google_client import get_genai_client
from services.supabase_client import get_supabase

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768


async def embed_text(text: str, *, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    """Genera embedding async. task_type='RETRIEVAL_QUERY' para queries.

    Forzamos output_dimensionality=768 porque la columna pgvector de Supabase
    está definida como vector(768). El modelo gemini-embedding-001 por default
    sale en 3072 — sin output_dimensionality, el insert a Supabase rompería.
    """
    client = get_genai_client()
    result = await client.aio.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=genai_types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=EMBEDDING_DIM,
        ),
    )
    return list(result.embeddings[0].values)


def chunk_manual(manual_text: str) -> list[dict[str, str]]:
    """Divide el manual por secciones markdown (##)."""
    chunks: list[dict[str, str]] = []
    current_title = "General"
    current_body: list[str] = []

    for line in manual_text.split("\n"):
        stripped = line.strip()
        if stripped.startswith("##"):
            if current_body:
                body = "\n".join(current_body).strip()
                if body:
                    chunks.append(
                        {"section_title": current_title, "chunk_text": body})
            current_title = stripped.lstrip("#").strip() or "General"
            current_body = []
        else:
            current_body.append(line)

    if current_body:
        body = "\n".join(current_body).strip()
        if body:
            chunks.append({"section_title": current_title, "chunk_text": body})

    if not chunks:
        chunks.append({"section_title": "Manual completo",
                      "chunk_text": manual_text})

    return chunks


async def save_manual_to_rag(manual_id: str, manual_text: str) -> int:
    """Chunkea, genera embeddings en paralelo, e inserta en Supabase."""
    supabase = await get_supabase()
    chunks = chunk_manual(manual_text)

    # El embedding incluye el title para mejorar recall cuando la query
    # menciona el nombre de la sección directamente.
    embeddings = await asyncio.gather(
        *(
            embed_text(
                f"{chunk['section_title']}\n\n{chunk['chunk_text']}",
                task_type="RETRIEVAL_DOCUMENT",
            )
            for chunk in chunks
        )
    )

    rows = [
        {
            "manual_id": manual_id,
            "section_title": chunk["section_title"],
            "chunk_text": chunk["chunk_text"],
            "embedding": embedding,
        }
        for chunk, embedding in zip(chunks, embeddings, strict=True)
    ]

    await supabase.table("brand_embeddings").insert(rows).execute()
    return len(rows)


def _build_fts_query(text: str) -> str:
    """Convierte texto natural a query OR para websearch_to_tsquery.

    websearch_to_tsquery trata espacios como AND — ningún chunk único contiene
    TODAS las keywords, por lo que fts_rank siempre sería null. Para forzar OR
    hay que usar la palabra literal 'OR' (en mayúsculas o minúsculas); el carácter
    '|' es ignorado por websearch_to_tsquery (lo trata como puntuación).

    También filtra tokens con guiones (websearch los interpreta como NOT) y
    guiones bajos (no matchean stems en español).
    """
    tokens = [
        w.strip(".,;:()")
        for w in text.split()
        if w.strip() and "-" not in w and "_" not in w and len(w) > 2
    ]
    seen: set[str] = set()
    unique = [t for t in tokens if not (t in seen or seen.add(t))]  # type: ignore[func-returns-value]
    return " OR ".join(unique) if unique else text


async def retrieve_context(
    query: str,
    manual_id: str,
    *,
    fts_keywords: str | None = None,
    k: int = 4,
    rrf_k: int = 60,
) -> list[dict[str, Any]]:
    """Hybrid search vía RPC.

    `query` → texto natural usado para el EMBEDDING (vector search).
        Puede incluir el contexto libre del usuario (campaña, canal, audiencia).
        El modelo de embeddings entiende lenguaje natural sin problema.

    `fts_keywords` → keywords curados usados para BM25 (sin texto del usuario).
        Si no se pasa, se reutiliza `query` (comportamiento legacy).
        Mantenerlo limpio evita que entradas con guiones, inglés o palabras
        ausentes en el manual rompan el match BM25.
    """
    supabase = await get_supabase()
    query_embedding = await embed_text(query, task_type="RETRIEVAL_QUERY")
    fts_query = _build_fts_query(fts_keywords or query)

    result = await supabase.rpc(
        "hybrid_search_brand",
        {
            "query_text": fts_query,
            "query_embedding": query_embedding,
            "manual_id_filter": manual_id,
            "match_count": k,
            "rrf_k": rrf_k,
        },
    ).execute()

    return result.data or []
