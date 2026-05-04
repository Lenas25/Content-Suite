"use client";

import axios, { AxiosError, type AxiosInstance } from "axios";

export const API_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    : "http://localhost:8000";

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 60_000,
});

// Inyectar Bearer token en cada request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout en 401 + normalización de errores
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string; source?: string }>) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("role");
      // Reload para volver al login screen — el AuthGuard del shell lo detecta
      window.location.reload();
    }
    return Promise.reject(error);
  },
);

/**
 * Helper genérico para devolver `data` directo y manejar errores con detail/source.
 * Las llamadas tipadas usan `api.post<T>(...)` directo cuando necesitan más control.
 */
export async function apiClient<T = unknown>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    params?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const { method = "GET", body, params } = options;
  const response = await api.request<T>({
    url: path,
    method,
    data: body,
    params,
  });
  return response.data;
}

/** Extrae un mensaje legible del error para mostrar en la UI. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (detail) return detail;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Error desconocido";
}
