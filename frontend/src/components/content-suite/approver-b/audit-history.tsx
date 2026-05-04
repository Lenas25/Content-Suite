"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Check, X, Image } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import {
  type AuditLog,
  type AuditSeverity,
  SEVERITY_STYLE,
} from "@/lib/types";

export function AuditHistory() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient<AuditLog[]>("/audit/logs")
      .then(setLogs)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  const passed = logs.filter((l) => l.passed).length;
  const failed = logs.filter((l) => !l.passed).length;

  return (
    <div className="p-4 md:p-6 max-w-full md:max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          Historial de Auditorías
        </h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">
          Todas las imágenes auditadas con Gemini Vision contra manuales de
          marca.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      {!isLoading && logs.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Total auditadas" value={logs.length} />
          <StatCard label="Aprobadas" value={passed} color="text-green-600" />
          <StatCard label="Rechazadas" value={failed} color="text-red-600" />
        </div>
      )}

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Image className="w-4 h-4 text-indigo-600" />
            Auditorías recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Todavía no hay auditorías registradas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Imagen</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Comentario</TableHead>
                    <TableHead>Checks</TableHead>
                    <TableHead>Auditado por</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-gray-600 max-w-[160px] truncate">
                        {log.image_filename ?? (
                          <span className="text-gray-300">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.passed ? (
                          <span className="inline-flex items-center gap-1 text-green-700 font-medium text-sm">
                            <Check className="w-3.5 h-3.5" />
                            Aprobada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 font-medium text-sm">
                            <X className="w-3.5 h-3.5" />
                            Rechazada
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm max-w-[280px]">
                        <p className="line-clamp-2">
                          {log.result.overall_comment}
                        </p>
                      </TableCell>
                      <TableCell>
                        <CheckSummary checks={log.result.checks} />
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 font-mono">
                        {log.audited_by}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-gray-900",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function CheckSummary({
  checks,
}: {
  checks: { passed: boolean; severity: AuditSeverity }[];
}) {
  const failed = checks.filter((c) => !c.passed);
  if (failed.length === 0) {
    return <span className="text-xs text-green-600">Todos OK</span>;
  }
  const worst = failed.reduce<AuditSeverity>((acc, c) => {
    const order: Record<AuditSeverity, number> = {
      low: 0,
      medium: 1,
      high: 2,
    };
    return order[c.severity] > order[acc] ? c.severity : acc;
  }, "low");
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${SEVERITY_STYLE[worst]}`}
    >
      {failed.length} fallido{failed.length > 1 ? "s" : ""}
    </span>
  );
}
