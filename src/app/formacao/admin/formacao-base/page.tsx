"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/useAuth";
import { Shield, BookOpen, Activity, Link as LinkIcon } from "lucide-react";

// Lazy-load existing page content
const CursosPage = dynamic(() => import("@/app/formacao/admin/cursos/page"), { ssr: false });


const AtalhosPage = dynamic(() => import("@/app/formacao/admin/atalhos/page"), { ssr: false });


const AnalyticsPage = dynamic(() => import("@/app/formacao/admin/analytics/page"), { ssr: false });

// `condutores` saiu daqui: virou área com porta própria na barra lateral. Era
// uma aba aninhada de onde não se voltava, porque "Ver feedbacks" levava para
// uma rota solta sem a barra de abas e o botão de voltar nunca devolvia para cá.
//
// `estatisticas` ficou, mas mudou de assunto: os dois cards de condutor dela
// foram para /admin/condutores, e o que restou é status do calendário, que não
// existe em nenhuma outra tela.
type SubTab = "cursos" | "atalhos" | "analytics";

const TABS: { key: SubTab; label: string; icon: typeof BookOpen }[] = [
  { key: "cursos", label: "Cursos", icon: BookOpen },
    { key: "atalhos", label: "Atalhos", icon: LinkIcon },
  { key: "analytics", label: "Analytics", icon: Activity },
];

const PAGE_MAP: Record<SubTab, React.ComponentType> = {
  cursos: CursosPage,
  atalhos: AtalhosPage,
  analytics: AnalyticsPage,
};

export default function FormacaoBasePage() {
  const { isAdmin, isInstructor } = useAuth();
  const [activeTab, setActiveTab] = useState<SubTab>("cursos");

  if (!isAdmin && !isInstructor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Shield className="w-12 h-12 text-[#C84B31] opacity-60" />
        <p className="font-dm text-sm text-[#FDFBF7]/50">
          Acesso restrito. Apenas administradores e instrutores podem aceder a esta página.
        </p>
      </div>
    );
  }

  const ActivePage = PAGE_MAP[activeTab];

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="font-dm text-xs px-3 py-2 sm:px-4 rounded-full flex items-center gap-1.5 transition-all min-h-[36px]"
              style={{
                backgroundColor: active ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
                color: active ? "#C84B31" : "rgba(253,251,247,0.4)",
                border: `1px solid ${active ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Active page content */}
      <ActivePage />
    </div>
  );
}
