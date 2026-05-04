-- Migración 001: BM25 más tolerante (plainto → websearch)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Por qué: plainto_tsquery hace AND entre todas las palabras del query;
-- con queries largas, ningún chunk matchea TODAS y BM25 devuelve 0.
-- websearch_to_tsquery usa OR por default, así matchea por CUALQUIERA
-- de las palabras (sintaxis tipo Google).

create or replace function hybrid_search_brand(
  query_text text,
  query_embedding vector(768),
  manual_id_filter uuid,
  match_count int default 4,
  rrf_k int default 60
)
returns table (
  id uuid,
  section_title text,
  chunk_text text,
  vector_rank bigint,
  fts_rank bigint,
  rrf_score float
)
language sql stable
as $$
  with vector_results as (
    select
      id,
      row_number() over (order by embedding <=> query_embedding) as rank
    from brand_embeddings
    where manual_id = manual_id_filter
    order by embedding <=> query_embedding
    limit 20
  ),
  fts_results as (
    select
      id,
      row_number() over (
        order by ts_rank(fts, websearch_to_tsquery('spanish', query_text)) desc
      ) as rank
    from brand_embeddings
    where manual_id = manual_id_filter
      and fts @@ websearch_to_tsquery('spanish', query_text)
    order by ts_rank(fts, websearch_to_tsquery('spanish', query_text)) desc
    limit 20
  ),
  rrf as (
    select
      coalesce(v.id, f.id) as id,
      v.rank as vector_rank,
      f.rank as fts_rank,
      coalesce(1.0 / (rrf_k + v.rank), 0.0) +
      coalesce(1.0 / (rrf_k + f.rank), 0.0) as rrf_score
    from vector_results v
    full outer join fts_results f on v.id = f.id
  )
  select
    rrf.id,
    be.section_title,
    be.chunk_text,
    rrf.vector_rank,
    rrf.fts_rank,
    rrf.rrf_score
  from rrf
  join brand_embeddings be on rrf.id = be.id
  order by rrf.rrf_score desc
  limit match_count;
$$;
