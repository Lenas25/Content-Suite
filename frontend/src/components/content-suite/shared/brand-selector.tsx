"use client";

import { useEffect, useState } from "react";
import { Loader2, Package, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import type { BrandManualSummary } from "@/lib/types";

interface BrandSelectorProps {
  value: string | null;
  onChange: (manualId: string, manual: BrandManualSummary) => void;
  /** Texto explicativo opcional debajo del selector. */
  hint?: string;
}

export function BrandSelector({ value, onChange, hint }: BrandSelectorProps) {
  const [manuals, setManuals] = useState<BrandManualSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient<BrandManualSummary[]>("/brand/manuals")
      .then(setManuals)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  const selected = manuals.find((m) => m.id === value);

  return (
    <Card className="border shadow-sm">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Package className="w-4 h-4 text-indigo-600" />
          Marca / Producto
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando manuales de marca...
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 px-3 py-2 rounded text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : manuals.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded">
            No hay manuales de marca todavía. El Creador debe generar uno desde
            "Brand DNA Architect" antes de continuar.
          </p>
        ) : (
          <>
            <select
              value={value ?? ""}
              onChange={(e) => {
                const m = manuals.find((x) => x.id === e.target.value);
                if (m) onChange(m.id, m);
              }}
              className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Selecciona una marca...</option>
              {manuals.map((m) => {
                const tone = m.tone?.trim() ?? "";
                const tonePreview =
                  tone.length > 60 ? `${tone.slice(0, 60).trimEnd()}…` : tone;
                return (
                  <option key={m.id} value={m.id}>
                    {m.product_name}
                    {tonePreview ? ` — ${tonePreview}` : ""}
                  </option>
                );
              })}
            </select>

            {selected && (
              <div className="text-xs text-gray-500 space-y-0.5">
                {selected.target_audience && (
                  <p>
                    <span className="font-medium text-gray-600">Público:</span>{" "}
                    {selected.target_audience}
                  </p>
                )}
                <p className="font-mono text-gray-400">
                  manual_id: {selected.id.slice(0, 8)}...
                </p>
              </div>
            )}

            {hint && <p className="text-xs text-gray-500">{hint}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
