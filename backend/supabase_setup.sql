-- ─────────────────────────────────────────────────────────────────────────────
-- Content Suite — Schema completo de Supabase
-- Ejecutar íntegramente en: Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extensión vectorial (pgvector)
create extension if not exists vector;

-- ─── MÓDULO I: Brand DNA Architect ───────────────────────────────────────────

-- 2. Manuales de marca generados por el LLM
create table if not exists brand_manuals (
  id              uuid primary key default gen_random_uuid(),
  product_name    text not null,
  tone            text,
  target_audience text,
  values          text,
  restrictions    text,
  raw_manual      text not null,   -- markdown completo generado
  created_at      timestamptz default now()
);

-- 3. Chunks vectoriales para RAG (hybrid search)
create table if not exists brand_embeddings (
  id            uuid primary key default gen_random_uuid(),
  manual_id     uuid references brand_manuals(id) on delete cascade,
  section_title text,
  chunk_text    text not null,
  embedding     vector(768),       -- gemini-embedding-001, dim=768
  -- columna generada para BM25 (full-text search en español)
  fts           tsvector generated always as (
    to_tsvector('spanish', coalesce(chunk_text, '') || ' ' || coalesce(section_title, ''))
  ) stored,
  created_at    timestamptz default now()
);

-- 4. Índice coseno para vector search
create index if not exists brand_embeddings_vec_idx
  on brand_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- 5. Índice GIN para BM25
create index if not exists brand_embeddings_fts_idx
  on brand_embeddings using gin(fts);

-- 6. Función Hybrid Search con Reciprocal Rank Fusion (RRF)
--    Combina similitud coseno (vector) + BM25 (tsvector) → ranking unificado.
--    websearch_to_tsquery usa OR entre palabras (más tolerante que plainto_tsquery).
--    k=60 es el valor estándar de RRF (empíricamente robusto, sin necesidad de tuning).
create or replace function hybrid_search_brand(
  query_text        text,
  query_embedding   vector(768),
  manual_id_filter  uuid,
  match_count       int default 4,
  rrf_k             int default 60
)
returns table (
  id            uuid,
  section_title text,
  chunk_text    text,
  vector_rank   bigint,
  fts_rank      bigint,
  rrf_score     float
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
      v.rank                as vector_rank,
      f.rank                as fts_rank,
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

-- ─── MÓDULO II: Creative Engine ───────────────────────────────────────────────

-- 7. Piezas de contenido generadas (descripciones, guiones, prompts de imagen)
create table if not exists content_items (
  id                uuid primary key default gen_random_uuid(),
  manual_id         uuid references brand_manuals(id),
  content_type      text not null,        -- 'descripcion_producto' | 'guion_video' | 'prompt_imagen'
  additional_context text,
  generated_text    text not null,
  status            text not null default 'pendiente',  -- 'pendiente' | 'aprobado' | 'rechazado'
  rejection_reason  text,
  audit_result      jsonb,                -- AuditResult vinculado (opcional)
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- 8. Trigger para mantener updated_at sincronizado
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists content_items_updated_at on content_items;
create trigger content_items_updated_at
  before update on content_items
  for each row execute function update_updated_at();

-- ─── MÓDULO III: Governance / Multimodal Audit ────────────────────────────────

-- 9. Historial de auditorías de imagen (independiente del flujo de texto)
--    content_id es nullable: el Aprobador B puede auditar imágenes sueltas
--    sin que estén vinculadas a un content_item generado.
create table if not exists audit_logs (
  id             uuid primary key default gen_random_uuid(),
  manual_id      uuid references brand_manuals(id) on delete set null,
  content_id     uuid references content_items(id) on delete set null,
  image_filename text,
  audited_by     text not null,    -- username del aprobador_b
  passed         boolean not null,
  result         jsonb not null,   -- {passed, overall_comment, checks: [...]}
  created_at     timestamptz default now()
);

create index if not exists audit_logs_created_at_idx
  on audit_logs (created_at desc);
