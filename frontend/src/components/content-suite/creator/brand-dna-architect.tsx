"use client";

import { useState } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiClient, getErrorMessage } from "@/lib/api-client";

interface BrandDnaArchitectProps {
  onManualSaved?: (manualId: string) => void;
}

interface BrandGenerateResponse {
  manual: string;
  model_used: string;
}

interface BrandSaveResponse {
  manual_id: string;
  chunks_stored: number;
}

export function BrandDnaArchitect({ onManualSaved }: BrandDnaArchitectProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedManual, setGeneratedManual] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [manualId, setManualId] = useState<string | null>(null);
  const [chunksStored, setChunksStored] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    productName: "",
    tone: "",
    audience: "",
    values: "",
    restrictions: "",
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSavedAt(null);
    setManualId(null);
    setChunksStored(null);

    try {
      const data = await apiClient<BrandGenerateResponse>("/brand/generate", {
        method: "POST",
        body: {
          product_name: formData.productName,
          tone: formData.tone,
          target_audience: formData.audience,
          values: formData.values,
          restrictions: formData.restrictions,
        },
      });
      setGeneratedManual(data.manual);
      setModelUsed(data.model_used);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedManual) return;
    setIsSaving(true);
    setError(null);

    try {
      const data = await apiClient<BrandSaveResponse>("/brand/save", {
        method: "POST",
        body: {
          product_name: formData.productName,
          tone: formData.tone,
          target_audience: formData.audience,
          values: formData.values,
          restrictions: formData.restrictions,
          manual: generatedManual,
        },
      });
      setManualId(data.manual_id);
      setChunksStored(data.chunks_stored);
      setSavedAt(new Date().toLocaleTimeString());
      onManualSaved?.(data.manual_id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmit = formData.productName.trim().length > 0 && !isGenerating;

  return (
    <div className="p-4 md:p-6 max-w-full md:max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          Brand DNA Architect
        </h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">
          Crea un manual de marca estructurado y lo indexa en el RAG.
        </p>
      </div>

      <Card className="mb-6 border shadow-sm">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Field label="Nombre del producto">
              <Input
                placeholder="Snack saludable de quinua"
                value={formData.productName}
                onChange={(e) =>
                  setFormData({ ...formData, productName: e.target.value })
                }
              />
            </Field>
            <Field label="Tono de comunicación">
              <Input
                placeholder="Divertido pero profesional, con onda Gen Z"
                value={formData.tone}
                onChange={(e) =>
                  setFormData({ ...formData, tone: e.target.value })
                }
              />
            </Field>
            <Field label="Público objetivo">
              <Input
                placeholder="Gen Z, 18-25 años, urbanos"
                value={formData.audience}
                onChange={(e) =>
                  setFormData({ ...formData, audience: e.target.value })
                }
              />
            </Field>
            <Field label="Valores de marca">
              <Textarea
                rows={3}
                placeholder="Salud accesible, autenticidad, sostenibilidad..."
                value={formData.values}
                onChange={(e) =>
                  setFormData({ ...formData, values: e.target.value })
                }
              />
            </Field>
            <Field label="Restricciones estrictas">
              <Textarea
                rows={3}
                placeholder="Sin claims de pérdida de peso. Sin tecnicismos. Evitar palabras culpa, dieta..."
                value={formData.restrictions}
                onChange={(e) =>
                  setFormData({ ...formData, restrictions: e.target.value })
                }
              />
            </Field>
            <Button
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generando manual...
                </>
              ) : (
                "Generar Manual de Marca"
              )}
            </Button>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Manual Generado</CardTitle>
            {modelUsed && (
              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {modelUsed}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!generatedManual ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
              <p className="text-gray-400">
                El manual aparecerá aquí en formato markdown.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="prose prose-sm prose-indigo max-w-none border rounded-lg p-5 bg-gray-50/50 max-h-[500px] overflow-y-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {generatedManual}
                </ReactMarkdown>
              </div>

              {savedAt && manualId && (
                <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm">
                  <Check className="w-4 h-4" />
                  Indexado en RAG ({chunksStored} chunks) · {savedAt}
                  <span className="font-mono text-xs ml-2 text-green-600">
                    ({manualId.slice(0, 8)}...)
                  </span>
                </div>
              )}

              <Button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={isSaving || !!savedAt}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : savedAt ? (
                  "Guardado"
                ) : (
                  "Guardar en Base Vectorial (RAG)"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
