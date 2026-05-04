interface HeaderProps {
  title: string;
}

const pageTitles: Record<string, string> = {
  "brand-dna": "Brand DNA Architect",
  "creative-engine": "Creative Engine",
  "my-generations": "Mis Generaciones",
  "review-inbox": "Bandeja de Revisión",
  history: "Historial",
  "visual-audit": "Auditoría Visual",
  "audit-history": "Historial Auditorías",
};

export function Header({ title }: HeaderProps) {
  return (
    <nav className="text-sm">
      <span className="text-gray-500">Dashboard</span>
      <span className="text-gray-400 mx-2">/</span>
      <span className="text-gray-900 font-medium">
        {pageTitles[title] || title}
      </span>
    </nav>
  );
}
