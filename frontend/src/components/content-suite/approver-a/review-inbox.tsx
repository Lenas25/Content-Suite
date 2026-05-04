"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Check,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import { type ContentItem, CONTENT_TYPE_LABEL } from "@/lib/types";
import { toUIStatus, STATUS_LABEL, STATUS_STYLE } from "@/lib/status";

export function ReviewInbox() {
  const [pendingItems, setPendingItems] = useState<ContentItem[]>([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [pending, approved, rejected] = await Promise.all([
        apiClient<ContentItem[]>("/content", {
          params: { status: "pendiente", limit: 50 },
        }),
        apiClient<ContentItem[]>("/content", {
          params: { status: "aprobado", limit: 100 },
        }),
        apiClient<ContentItem[]>("/content", {
          params: { status: "rechazado", limit: 100 },
        }),
      ]);
      setPendingItems(pending);
      setStats({
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
      });
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateStatus = async (
    id: string,
    status: "aprobado" | "rechazado",
    reason?: string,
  ) => {
    setLoadingIds((prev) => new Set(prev).add(id));
    try {
      await apiClient(`/content/${id}/status`, {
        method: "PATCH",
        body: { status, rejection_reason: reason ?? null },
      });
      await refresh();
      if (status === "rechazado") {
        setRejectingId(null);
        setRejectionReason("");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-full md:max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          Bandeja de Revisión
        </h1>
        <Button
          variant="outline"
          onClick={() => refresh()}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Refrescar"
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          bg="bg-amber-100"
          label="Pendientes"
          value={stats.pending}
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          bg="bg-green-100"
          label="Aprobados"
          value={stats.approved}
        />
        <StatCard
          icon={<XCircle className="w-5 h-5 text-red-600" />}
          bg="bg-red-100"
          label="Rechazados"
          value={stats.rejected}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="ml-2 text-gray-500">Cargando contenido...</span>
        </div>
      ) : pendingItems.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-12 text-center text-gray-500">
            No hay contenido pendiente de revisión.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingItems.map((item) => {
            const ui = toUIStatus(item.status);
            const inFlight = loadingIds.has(item.id);
            return (
              <Card key={item.id} className="border shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        {CONTENT_TYPE_LABEL[item.content_type]}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-500 line-clamp-1">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[ui]} flex-shrink-0`}
                    >
                      {STATUS_LABEL[ui]}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                    {item.generated_text}
                  </p>

                  {rejectingId === item.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Motivo de rechazo
                        </label>
                        <Textarea
                          rows={2}
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Explicá por qué rechazás este contenido..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() =>
                            updateStatus(item.id, "rechazado", rejectionReason)
                          }
                          disabled={inFlight || !rejectionReason.trim()}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {inFlight ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : null}
                          Confirmar Rechazo
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectionReason("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => updateStatus(item.id, "aprobado")}
                        disabled={inFlight}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {inFlight ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-1" />
                        )}
                        Aprobar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setRejectingId(item.id)}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Rechazar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  bg,
  label,
  value,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: number;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}
          >
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
