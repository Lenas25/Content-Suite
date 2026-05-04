-- ─────────────────────────────────────────────────────────────────────────────
-- Content Suite — Schema Supabase
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Habilitar la extensión vectorial
create extension if not exists vector;

-- 2. Tabla de manuales de marca
create table if not exists brand_manuals (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  tone text,
  target_audience text,
  values text,
  restrictions text,
  raw_manual text not null,
  created_at timestamptz default now()
);

-- 3. Tabla de chunks vectoriales
create table if not exists brand_embeddings (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid references brand_manuals(id) on delete cascade,
  section_title text,
  chunk_text text not null,
  embedding vector(768),
  fts tsvector generated always as (
    to_tsvector('spanish', coalesce(chunk_text, '') || ' ' || coalesce(section_title, ''))
  ) stored,
  created_at timestamptz default now()
);

-- 4. Índice vectorial (similitud coseno)
create index if not exists brand_embeddings_vec_idx
  on brand_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- 4. Índice GIN para full-text search (BM25)
create index if not exists brand_embeddings_fts_idx
  on brand_embeddings using gin(fts);

-- 5. Función de Hybrid Search con Reciprocal Rank Fusion (RRF)
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

-- 6. Tabla de contenido generado
create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid references brand_manuals(id),
  content_type text not null,
  additional_context text,
  generated_text text not null,
  status text not null default 'pendiente',
  rejection_reason text,
  audit_result jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. Trigger para updated_at automático
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists content_items_updated_at on content_items;
create trigger content_items_updated_at
  before update on content_items
  for each row execute function update_updated_at();
