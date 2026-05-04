"use client";

import { useState, useCallback } from "react";
import {
  CloudUpload,
  CheckCircle,
  XCircle,
  Check,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, getErrorMessage } from "@/lib/api-client";
import {
  type AuditResult,
  type AuditCheck,
  AUDIT_CATEGORY_LABEL,
  SEVERITY_STYLE,
} from "@/lib/types";
import { BrandSelector } from "@/components/content-suite/shared/brand-selector";

export function VisualAudit() {
  const [selectedManualId, setSelectedManualId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((file: File) => {
    setSelectedFile(file);
    setAuditResult(null);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) handleFileChange(file);
    },
    [handleFileChange],
  );

  const handleRunAudit = async () => {
    if (!selectedFile || !selectedManualId) return;
    setIsAuditing(true);
    setError(null);
    setAuditResult(null);

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("manual_id", selectedManualId);

    try {
      const { data } = await api.post<AuditResult>("/audit/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAuditResult(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsAuditing(false);
    }
  };

  const canAudit = !!selectedFile && !!selectedManualId && !isAuditing;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Auditoría Multimodal
        </h1>
        <p className="text-gray-500 mt-1">
          Subí una imagen y contrastala contra un manual de marca con Gemini Vision.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna izquierda: selector de marca + upload */}
        <div className="space-y-4">
          <BrandSelector
            value={selectedManualId}
            onChange={(id) => setSelectedManualId(id)}
            hint="La imagen se contrastará contra las restricciones visuales y reglas de este manual."
          />

          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">
                Imagen a auditar
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!imagePreview ? (
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <CloudUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium mb-1">
                    Arrastra tu imagen aquí
                  </p>
                  <p className="text-sm text-gray-400 mb-4">PNG · JPG · WEBP</p>
                  <label className="text-indigo-600 hover:text-indigo-700 text-sm font-medium cursor-pointer">
                    Seleccionar archivo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileChange(f);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="border-2 border-gray-200 rounded-xl p-4 text-center bg-gray-50">
                  <img
                    src={imagePreview}
                    alt="Vista previa"
                    className="w-full h-64 object-contain rounded-lg bg-white"
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    {selectedFile?.name}
                  </p>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setImagePreview(null);
                      setAuditResult(null);
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700 mt-2"
                  >
                    Cambiar imagen
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            onClick={handleRunAudit}
            disabled={!canAudit}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
          >
            {isAuditing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Auditando con Gemini...
              </>
            ) : (
              "Ejecutar Auditoría Multimodal"
            )}
          </Button>
        </div>

        {/* Columna derecha: resultado */}
        <div>
          {!auditResult && !isAuditing && (
            <Card className="border-2 border-dashed border-gray-200 shadow-none">
              <CardContent className="py-12 text-center text-gray-400">
                <p className="text-sm">
                  El resultado de la auditoría aparecerá aquí.
                </p>
                <p className="text-xs mt-2">
                  1. Seleccioná una marca · 2. Subí una imagen · 3. Ejecutá la auditoría
                </p>
              </CardContent>
            </Card>
          )}

          {isAuditing && (
            <Card className="border shadow-sm">
              <CardContent className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600">
                  Gemini está analizando la imagen contra el manual de marca...
                </p>
              </CardContent>
            </Card>
          )}

          {auditResult && <AuditResultCard result={auditResult} />}
        </div>
      </div>
    </div>
  );
}

function AuditResultCard({ result }: { result: AuditResult }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="pt-6">
        <div className="text-center mb-4">
          {result.passed ? (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <p className="text-lg font-bold text-green-700">
                Cumple con el manual de marca
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <p className="text-lg font-bold text-red-700">
                No cumple con el manual
              </p>
            </>
          )}
          <p className="text-sm text-gray-600 mt-2 italic">
            {result.overall_comment}
          </p>
        </div>

        <ul className="space-y-3">
          {result.checks.map((check, i) => (
            <CheckRow key={i} check={check} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CheckRow({ check }: { check: AuditCheck }) {
  return (
    <li className="border-l-4 border-gray-200 pl-3">
      <div className="flex items-start gap-2">
        {check.passed ? (
          <Check className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
        ) : (
          <X className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 uppercase">
              {AUDIT_CATEGORY_LABEL[check.category]}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_STYLE[check.severity]}`}
            >
              {check.severity}
            </span>
          </div>
          <p
            className={`text-sm font-medium ${check.passed ? "text-green-700" : "text-red-700"} mt-0.5`}
          >
            {check.rule}
          </p>
          <p className="text-xs text-gray-600 mt-1">{check.detail}</p>
        </div>
      </div>
    </li>
  );
}
