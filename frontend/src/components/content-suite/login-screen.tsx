"use client";

import { useState } from "react";
import { Pencil, CheckCircle, Camera, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

export type Role = "creador" | "aprobador_a" | "aprobador_b";

interface LoginScreenProps {
  onLogin: (role: Role) => void;
}

const roles = [
  {
    id: "creador" as Role,
    username: "creador",
    name: "Creador",
    description: "Genera manuales de marca y contenido creativo",
    icon: Pencil,
  },
  {
    id: "aprobador_a" as Role,
    username: "aprobador_a",
    name: "Aprobador A",
    description: "Revisa y aprueba el contenido generado",
    icon: CheckCircle,
  },
  {
    id: "aprobador_b" as Role,
    username: "aprobador_b",
    name: "Aprobador B",
    description: "Realiza auditoría multimodal con imágenes",
    icon: Camera,
  },
];

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [selectedRole, setSelectedRole] = useState<
    (typeof roles)[number] | null
  >(null);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!selectedRole) return;

    setIsLoading(true);
    setError("");

    try {
      const data = await apiClient<{ access_token: string; role: Role }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ username: selectedRole.username, password }),
        },
      );
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("role", data.role);
      onLogin(data.role);
    } catch {
      setError("Credenciales incorrectas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRole = (role: (typeof roles)[number]) => {
    setSelectedRole(role);
    setPassword("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="pt-8 pb-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Content Suite
            </h1>
            <p className="text-gray-500">Selecciona tu rol para continuar</p>
          </div>
          <div className="flex flex-col gap-3">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleSelectRole(role)}
                className={`flex items-center gap-4 p-4 rounded-xl border bg-white transition-all text-left group ${
                  selectedRole?.id === role.id
                    ? "border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50/50"
                    : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                    selectedRole?.id === role.id
                      ? "bg-indigo-200"
                      : "bg-indigo-100 group-hover:bg-indigo-200"
                  }`}
                >
                  <role.icon className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{role.name}</p>
                  <p className="text-sm text-gray-500">{role.description}</p>
                </div>
              </button>
            ))}
          </div>

          {selectedRole && (
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contraseña
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin();
                  }}
                />
              </div>

              <Button
                onClick={handleLogin}
                disabled={isLoading || !password}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  "Ingresar"
                )}
              </Button>

              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
