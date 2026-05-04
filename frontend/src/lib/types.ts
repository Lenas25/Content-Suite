/** Tipos espejo de los Pydantic schemas del backend. */

import type { BackendStatus } from "./status";

export interface BrandManualSummary {
  id: string;
  product_name: string;
  tone: string | null;
  target_audience: string | null;
  created_at: string;
}

export type ContentType =
  | "descripcion_producto"
  | "guion_video"
  | "prompt_imagen";

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  descripcion_producto: "Descripción de Producto",
  guion_video: "Guión de Video",
  prompt_imagen: "Prompt de Imagen",
};

export interface RagChunkInfo {
  section_title: string;
  vector_rank: number | null;
  fts_rank: number | null;
  rrf_score: number;
}

export interface ContentGenerateResponse {
  content_id: string;
  generated_text: string;
  model_used: string;
  rag_chunks_used: string[];
  rag_detail: RagChunkInfo[];
  status: BackendStatus;
}

export interface ContentItem {
  id: string;
  manual_id: string;
  content_type: ContentType;
  additional_context: string | null;
  generated_text: string;
  status: BackendStatus;
  rejection_reason: string | null;
  audit_result: AuditResult | null;
  created_at: string;
  updated_at: string;
}

export type AuditCategory =
  | "uso_logo"
  | "colores_estilo"
  | "publico_representado"
  | "temas_sensibles"
  | "claims_implicitos";

export type AuditSeverity = "low" | "medium" | "high";

export interface AuditCheck {
  category: AuditCategory;
  rule: string;
  passed: boolean;
  severity: AuditSeverity;
  detail: string;
}

export interface AuditResult {
  passed: boolean;
  overall_comment: string;
  checks: AuditCheck[];
}

export interface AuditLog {
  id: string;
  manual_id: string | null;
  content_id: string | null;
  image_filename: string | null;
  audited_by: string;
  passed: boolean;
  result: AuditResult;
  created_at: string;
}

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
  uso_logo: "Uso del logo",
  colores_estilo: "Colores y estilo",
  publico_representado: "Público representado",
  temas_sensibles: "Temas sensibles",
  claims_implicitos: "Claims implícitos",
};

export const SEVERITY_STYLE: Record<AuditSeverity, string> = {
  low: "bg-yellow-100 text-yellow-700",
  medium: "bg-orange-100 text-orange-700",
  high: "bg-red-100 text-red-700",
};
