"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
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
import { type ContentItem, CONTENT_TYPE_LABEL } from "@/lib/types";
import { toUIStatus, STATUS_LABEL, STATUS_STYLE } from "@/lib/status";

export function MyGenerations() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient<ContentItem[]>("/content", { params: { limit: 100 } })
      .then(setItems)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-full md:max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          Mis Generaciones
        </h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">
          Historial de contenido generado.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Últimas generaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Todavía no generaste contenido.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vista previa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const ui = toUIStatus(item.status);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {CONTENT_TYPE_LABEL[item.content_type]}
                      </TableCell>
                      <TableCell className="text-gray-500 max-w-[400px] truncate">
                        {item.generated_text.slice(0, 80)}...
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[ui]}`}
                        >
                          {STATUS_LABEL[ui]}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {new Date(item.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
