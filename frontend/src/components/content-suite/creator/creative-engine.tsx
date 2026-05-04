"use client";

import { useState, useEffect } from "react";
import { Database, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiClient, getErrorMessage } from "@/lib/api-client";
import {
  type ContentGenerateResponse,
  type ContentType,
  type RagChunkInfo,
  CONTENT_TYPE_LABEL,
} from "@/lib/types";
import { BrandSelector } from "@/components/content-suite/shared/brand-selector";

interface CreativeEngineProps {
  /** Manual recién guardado en la sesión (precarga del shell). El usuario puede cambiarlo. */
  manualId: string | null;
}

const TAB_TO_CONTENT_TYPE: Record<string, ContentType> = {
  description: "descripcion_producto",
  script: "guion_video",
  imagePrompt: "prompt_imagen",
};

const PLACEHOLDERS: Record<string, string> = {
  description: "Lanzamiento campaña verano, canal e-commerce y redes...",
  script: "Duración 30s, plataforma TikTok/Instagram, estilo lifestyle...",
  imagePrompt: "Lifestyle urbano, persona joven, ambiente cálido...",
};

export function CreativeEngine({ manualId: initialManualId }: CreativeEngineProps) {
  const [selectedManualId, setSelectedManualId] = useState<string | null>(
    initialManualId,
  );
  const [activeTab, setActiveTab] = useState("description");
  const [isGenerating, setIsGenerating] = useState(false);
  const [response, setResponse] = useState<ContentGenerateResponse | null>(
    null,
  );
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Si el shell pasa un nuevo manualId (creador acaba de guardar uno), precargarlo.
  useEffect(() => {
    if (initialManualId) setSelectedManualId(initialManualId);
  }, [initialManualId]);

  const handleGenerate = async () => {
    if (!selectedManualId) return;
    setIsGenerating(true);
    setResponse(null);
    setError(null);
    try {
      const data = await apiClient<ContentGenerateResponse>(
        "/content/generate",
        {
          method: "POST",
          body: {
            manual_id: selectedManualId,
            content_type: TAB_TO_CONTENT_TYPE[activeTab],
            additional_context: context,
          },
        },
      );
      setResponse(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setResponse(null);
    setError(null);
    setContext("");
  };

  return (
    <div className="p-4 md:p-6 max-w-full md:max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          Creative Engine
        </h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">
          Genera contenido alineado al manual de marca usando hybrid RAG.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4 w-full grid grid-cols-1 sm:grid-cols-3 gap-0 sm:gap-0">
          <TabsTrigger
            value="description"
            className="flex-1 text-xs sm:text-sm"
          >
            Descripción de Producto
          </TabsTrigger>
          <TabsTrigger value="script" className="flex-1 text-xs sm:text-sm">
            Guión de Video
          </TabsTrigger>
          <TabsTrigger
            value="imagePrompt"
            className="flex-1 text-xs sm:text-sm"
          >
            Prompt de Imagen
          </TabsTrigger>
        </TabsList>

        <div className="space-y-4">
          <BrandSelector
            value={selectedManualId}
            onChange={(id) => setSelectedManualId(id)}
            hint="El contenido se genera con hybrid RAG sobre el manual seleccionado."
          />

          {(["description", "script", "imagePrompt"] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0">
              <Card className="border shadow-sm">
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Contexto adicional
                    </label>
                    <Textarea
                      rows={3}
                      placeholder={PLACEHOLDERS[tab]}
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !selectedManualId}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      "Generar Contenido"
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {response && (
            <>
              <Card className="border shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {CONTENT_TYPE_LABEL[TAB_TO_CONTENT_TYPE[activeTab]]}
                    </CardTitle>
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {response.model_used}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                      {response.generated_text}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <RagDetailCard chunks={response.rag_detail} />
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}

function RagDetailCard({ chunks }: { chunks: RagChunkInfo[] }) {
  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" />
          Hybrid RAG — chunks aplicados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 text-xs uppercase">
                <th className="pb-2 font-medium">Sección</th>
                <th className="pb-2 font-medium text-center">Vector rank</th>
                <th className="pb-2 font-medium text-center">FTS rank</th>
                <th className="pb-2 font-medium text-right">RRF score</th>
              </tr>
            </thead>
            <tbody>
              {chunks.map((c, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2.5 font-medium text-gray-900">
                    {c.section_title}
                  </td>
                  <td className="py-2.5 text-center">
                    {c.vector_rank ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 text-center">
                    {c.fts_rank ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs text-gray-600">
                    {c.rrf_score.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Vector rank: ranking por similitud coseno · FTS rank: ranking por BM25
          (palabras exactas) · RRF: fusión de ambos. — significa que el chunk no
          matcheó en esa búsqueda.
        </p>
      </CardContent>
    </Card>
  );
}
