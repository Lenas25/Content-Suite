"use client";

import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import {
  LoginScreen,
  type Role,
} from "@/components/content-suite/login-screen";
import { Sidebar } from "@/components/content-suite/sidebar";
import { Header } from "@/components/content-suite/header";
import { BrandDnaArchitect } from "@/components/content-suite/creator/brand-dna-architect";
import { CreativeEngine } from "@/components/content-suite/creator/creative-engine";
import { MyGenerations } from "@/components/content-suite/creator/my-generations";
import { ReviewInbox } from "@/components/content-suite/approver-a/review-inbox";
import { ApproverAHistory } from "@/components/content-suite/approver-a/history";
import { VisualAudit } from "@/components/content-suite/approver-b/visual-audit";
import { AuditHistory } from "@/components/content-suite/approver-b/audit-history";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const defaultPages: Record<Role, string> = {
  creador: "brand-dna",
  aprobador_a: "review-inbox",
  aprobador_b: "visual-audit",
};

export function ContentSuiteApp() {
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [currentPage, setCurrentPage] = useState<string>("");
  const [manualId, setManualId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check localStorage on mount for existing session
  useEffect(() => {
    const storedRole = localStorage.getItem("role") as Role | null;
    const storedToken = localStorage.getItem("access_token");

    if (storedRole && storedToken) {
      setCurrentRole(storedRole);
      setCurrentPage(defaultPages[storedRole]);
    }
    setIsHydrated(true);
  }, []);

  const handleLogin = (role: Role) => {
    setCurrentRole(role);
    setCurrentPage(defaultPages[role]);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    setCurrentRole(null);
    setCurrentPage("");
    setManualId(null);
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    setSidebarOpen(false); // Cerrar drawer al navegar en móvil
  };

  // Show nothing until hydrated to avoid hydration mismatch
  if (!isHydrated) {
    return null;
  }

  if (!currentRole) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (currentPage) {
      // Creator pages
      case "brand-dna":
        return <BrandDnaArchitect onManualSaved={setManualId} />;
      case "creative-engine":
        return <CreativeEngine manualId={manualId} />;
      case "my-generations":
        return <MyGenerations />;
      // Approver A pages
      case "review-inbox":
        return <ReviewInbox />;
      case "history":
        return <ApproverAHistory />;
      // Approver B pages
      case "visual-audit":
        return <VisualAudit />;
      case "audit-history":
        return <AuditHistory />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden md:block md:w-60 md:flex-shrink-0 md:fixed md:inset-y-0 md:left-0">
        <Sidebar
          role={currentRole}
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Sidebar with Sheet */}
      <div className="md:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            {/* El trigger está en el Header */}
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <Sidebar
              role={currentRole}
              currentPage={currentPage}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-60 overflow-hidden">
        {/* Header with Mobile Toggle */}
        <div className="flex items-center gap-4 px-4 md:px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <button className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
                <Menu className="w-6 h-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0">
              <Sidebar
                role={currentRole}
                currentPage={currentPage}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
              />
            </SheetContent>
          </Sheet>
          <div className="flex-1">
            <Header title={currentPage} />
          </div>
        </div>

        {/* Content Area - Only scrolls here */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto w-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
