"use client";

import { LogOut } from "lucide-react";
import type { Role } from "./login-screen";

interface SidebarProps {
  role: Role;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const roleNames: Record<Role, string> = {
  creador: "Creador",
  aprobador_a: "Aprobador A",
  aprobador_b: "Aprobador B",
};

const navItems: Record<Role, { id: string; label: string }[]> = {
  creador: [
    { id: "brand-dna", label: "Brand DNA Architect" },
    { id: "creative-engine", label: "Creative Engine" },
    { id: "my-generations", label: "Mis Generaciones" },
  ],
  aprobador_a: [
    { id: "review-inbox", label: "Bandeja de Revisión" },
    { id: "history", label: "Historial" },
  ],
  aprobador_b: [
    { id: "visual-audit", label: "Auditoría Visual" },
    { id: "audit-history", label: "Historial Auditorías" },
  ],
};

export function Sidebar({
  role,
  currentPage,
  onNavigate,
  onLogout,
}: SidebarProps) {
  // Validar que role existe en navItems
  const items = navItems[role];

  if (!items) {
    console.error(
      `Invalid role: ${role}. Expected one of: creador, aprobador_a, aprobador_b`,
    );
    return null;
  }

  return (
    <aside className="h-screen bg-[#1E1B4B] text-white flex flex-col overflow-y-auto">
      <div className="p-6 flex-shrink-0">
        <h1 className="text-xl font-bold mb-3">Content Suite</h1>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-600 text-white">
          {roleNames[role]}
        </span>
      </div>

      <nav className="flex-1 px-3 min-h-0 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
              currentPage === item.id
                ? "bg-indigo-900/80 border-l-2 border-indigo-400"
                : "hover:bg-white/10"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-3 mt-auto flex-shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
