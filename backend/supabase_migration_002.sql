-- Migration 002: tabla audit_logs
-- Persiste TODAS las auditorías de imagen, estén o no vinculadas a un content_item.

create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  manual_id    uuid references brand_manuals(id) on delete set null,
  content_id   uuid references content_items(id) on delete set null,  -- nullable
  image_filename text,
  audited_by   text not null,   -- username del aprobador_b
  passed       boolean not null,
  result       jsonb not null,  -- AuditResult completo {passed, overall_comment, checks}
  created_at   timestamptz default now()
);

-- Índice para listar por fecha descendente (la consulta más común)
create index if not exists audit_logs_created_at_idx
  on audit_logs (created_at desc);
