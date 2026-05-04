/** Mapeo entre el status del backend (español) y el que usa la UI (inglés). */

export type BackendStatus = "pendiente" | "aprobado" | "rechazado";
export type UIStatus = "pending" | "approved" | "rejected";

const BACKEND_TO_UI: Record<BackendStatus, UIStatus> = {
  pendiente: "pending",
  aprobado: "approved",
  rechazado: "rejected",
};

const UI_TO_BACKEND: Record<UIStatus, BackendStatus> = {
  pending: "pendiente",
  approved: "aprobado",
  rejected: "rechazado",
};

export function toUIStatus(s: BackendStatus): UIStatus {
  return BACKEND_TO_UI[s];
}

export function toBackendStatus(s: UIStatus): BackendStatus {
  return UI_TO_BACKEND[s];
}

export const STATUS_LABEL: Record<UIStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const STATUS_STYLE: Record<UIStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};
