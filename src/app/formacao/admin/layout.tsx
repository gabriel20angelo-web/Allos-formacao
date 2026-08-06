"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import CourseBackground from "@/components/course/CourseBackground";
import { useAuth } from "@/hooks/useAuth";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import {
  LayoutDashboard,
  Award,
  Settings,
  MessageSquare,
  LogOut,
  ChevronLeft,
  Menu,
  X,
  User,
  Calendar,
  Users,
  UserSearch,
} from "lucide-react";
import { countSugestoesPendentes } from "@/lib/queries/aprimoramento-sugestoes-admin";
import { NOME_DO_CARGO } from "@/lib/cargos";
import {
  AREAS,
  GRUPOS,
  areasDoPainel,
  caminhosDoPainel,
  homeDoPainel,
} from "@/lib/areas";

/**
 * O ícone de cada área.
 *
 * Mora aqui e não no catálogo porque o catálogo também é lido pelo middleware,
 * que roda no edge e não deve arrastar a biblioteca de ícones junto.
 */
const ICONE_DA_AREA: Record<string, typeof LayoutDashboard> = {
  "associados-admin": Users,
  dashboard: LayoutDashboard,
  "formacao-base": Calendar,
  pessoas: UserSearch,
  certificados: Award,
  moderacao: MessageSquare,
  configuracoes: Settings,
};

/** Onde o contador de sugestões pendentes aparece. */
const AREA_COM_PENDENCIAS = "associados-admin";

// Telas que não são áreas do catálogo, mas têm nome próprio na barra de cima.
const TITULOS_EXTRAS: Record<string, string> = {
  "/formacao/admin/associados/aprimoramento": "Aprimoramento de Dinâmicas",
  "/formacao/admin/associados/sugestoes": "Sugestões",
  "/formacao/admin/condutores": "Condutores",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, loading, signOut, cargos, isAdmin } = useAuth();
  const pathname = usePathname();

  // A navegação sai do catálogo, agrupada em seções.
  //
  // Antes isto era um ternário — eventos, senão condutor, senão tudo — e ele
  // apagava o menu de quem acumula cargo: quem cuida dos eventos E conduz um
  // grupo via só Eventos, e um administrador com o cargo de eventos marcado
  // perdia o painel inteiro. O erro nem aparecia como erro: a área continuava
  // existindo, funcionando, e sem link nenhum apontando para ela.
  const minhasAreas = areasDoPainel(cargos);
  const secoes = [
    // Área sem grupo abre a lista, sem título. Hoje é só Associados, que não
    // pertence nem à Formação nem ao Sistema.
    { id: "", titulo: "", itens: minhasAreas.filter((a) => !a.grupo) },
    ...GRUPOS.map((g) => ({
      ...g,
      itens: minhasAreas.filter((a) => a.grupo === g.id),
    })),
  ].filter((s) => s.itens.length > 0);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingSugestoes, setPendingSugestoes] = useState(0);
  // Auth/role check is enforced by middleware at src/lib/supabase/middleware.ts
  // (lines 100-112) — no client-side useEffect needed.

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    countSugestoesPendentes()
      .then((n) => {
        if (!cancelled) setPendingSugestoes(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdmin, pathname]);

  // useEffect ANTES de qualquer early return pra respeitar Rules of Hooks.
  useEffect(() => {
    const nav = document.querySelector("nav.fixed");
    const footer = document.querySelector("footer");
    const floating = document.querySelector("[data-floating-question]");
    if (nav) (nav as HTMLElement).style.display = "none";
    if (footer) (footer as HTMLElement).style.display = "none";
    if (floating) (floating as HTMLElement).style.display = "none";
    document.body.style.paddingTop = "0";
    return () => {
      if (nav) (nav as HTMLElement).style.display = "";
      if (footer) (footer as HTMLElement).style.display = "";
      if (floating) (floating as HTMLElement).style.display = "";
      document.body.style.paddingTop = "";
    };
  }, []);

  // Esc fecha o drawer mobile.
  useEffect(() => {
    if (!sidebarOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  // O mais específico primeiro: /associados/sugestoes precisa vencer
  // /associados, que também casa por prefixo.
  const titulosPorCaminho: [string, string][] = [
    ...Object.entries(TITULOS_EXTRAS),
    ...AREAS.filter((a) => a.href.startsWith("/formacao/admin")).map(
      (a) => [a.href, a.rotulo] as [string, string]
    ),
  ].sort((a, b) => b[0].length - a[0].length);

  const currentPageTitle =
    titulosPorCaminho.find(
      ([path]) =>
        pathname === path || (path !== "/formacao/admin" && pathname.startsWith(`${path}/`))
    )?.[1] || "Painel";

  if (loading) {
    return (
      <div className="flex h-screen" style={{ background: "#111111" }}>
        <div className="w-64 p-6 space-y-4" style={{ background: "#0D0D0D" }}>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-10 w-1/3 mb-8" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile || caminhosDoPainel(cargos).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#111111" }}>
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-fraunces font-bold text-2xl text-cream">
            Acesso restrito
          </h1>
          {/* O painel ficou para quem administra a plataforma. Quem conduz um
              grupo, é associado ou cuida dos eventos trabalha em
              /formacao/associados, no site, e o middleware já leva para lá — só
              chega nesta tela quem não tem nenhum dos dois. */}
          <p className="text-cream/50 text-sm">
            Esta área é de quem administra a plataforma. Se você conduz um grupo, é associado ou
            cuida dos eventos, o seu lugar é em Associados, no menu do site.
          </p>
          <Link
            href="/formacao"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium text-cream"
            style={{
              background: "linear-gradient(135deg, #C84B31, #A33D27)",
              boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
            }}
          >
            Voltar para o site
          </Link>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Brand with logo */}
      <div className="p-6" style={{ borderBottom: "1px solid rgba(200,75,49,0.1)" }}>
        <Link href={homeDoPainel(cargos)} className="flex items-center gap-2.5">
          <Image src="/Icone_Allos_Verde.png" alt="Allos" width={28} height={28} />
          <div>
            <span className="font-fraunces font-bold text-[16px] text-cream tracking-wide">Allos</span>
            <span className="block font-dm text-[8px] tracking-[.28em] text-accent uppercase -mt-0.5">Painel Admin</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-5 overflow-y-auto">
        {secoes.map((secao) => (
          <div key={secao.id || "sem-grupo"} className="space-y-1">
            {secao.titulo && (
              <p className="px-4 pb-1 font-dm text-[10px] font-semibold tracking-[0.22em] uppercase text-cream/25">
                {secao.titulo}
              </p>
            )}

            {secao.itens.map((area) => {
              const Icone = ICONE_DA_AREA[area.id] ?? LayoutDashboard;
              const isActive =
                pathname === area.href ||
                (area.href !== "/formacao/admin" &&
                  pathname.startsWith(`${area.href}/`));

              return (
                <Link
                  key={area.id}
                  href={area.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-2.5 rounded-[10px] text-sm
                    transition-all duration-200
                    ${
                      isActive
                        ? "text-white font-semibold"
                        : "text-cream/50 hover:text-cream hover:bg-white/5"
                    }
                  `}
                  style={
                    isActive
                      ? {
                          background: "linear-gradient(135deg, #C84B31, #A33D27)",
                          boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
                        }
                      : {}
                  }
                >
                  <Icone className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{area.rotulo}</span>

                  {area.id === AREA_COM_PENDENCIAS && pendingSugestoes > 0 && (
                    <span
                      className="font-dm text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                      style={{
                        color: isActive ? "#FDFBF7" : "#D4A857",
                        background: isActive
                          ? "rgba(255,255,255,0.18)"
                          : "rgba(212,168,87,0.14)",
                        border: `1px solid ${
                          isActive
                            ? "rgba(255,255,255,0.28)"
                            : "rgba(212,168,87,0.32)"
                        }`,
                      }}
                      aria-label={`${pendingSugestoes} sugestões pendentes`}
                    >
                      {pendingSugestoes}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Back to site */}
      <div className="p-4" style={{ borderTop: "1px solid rgba(200,75,49,0.08)" }}>
        <Link
          href="/formacao"
          className="flex items-center gap-2 px-4 py-2 text-sm text-cream/35 hover:text-accent transition-colors duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar ao site
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen relative">
      {/* Starfield + grain + orbs */}
      <CourseBackground />

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:block w-64 flex-shrink-0 relative z-10"
        style={{
          background: "rgba(13,13,13,0.75)",
          borderRight: "1px solid rgba(200,75,49,0.06)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute top-0 left-0 w-64 h-full"
              style={{ background: "#0D0D0D" }}
            >
              <div className="flex justify-end p-4">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-cream/50 hover:text-cream transition-colors"
                  aria-label="Fechar menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Topbar */}
        <header
          className="h-16 flex items-center justify-between px-6 flex-shrink-0"
          style={{
            background: "rgba(17,17,17,0.6)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(200,75,49,0.06)",
          }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-3 -ml-2 text-cream"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Page title */}
            <h2 className="font-dm font-semibold text-cream/70 text-sm hidden sm:block">
              {currentPageTitle}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* No celular o nome mais as pílulas de cargo tomavam duas linhas e
                empurravam o cabeçalho por cima do botão de menu. Quem precisa
                conferir o cargo abre o menu; aqui ficam avatar e sair. */}
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-cream">
                {profile.full_name}
              </p>
              {/* A cadeia de ternários que estava aqui não tinha caso para
                  condutor, então quem conduz lia "Aluno" no próprio painel. E
                  mostrava só o papel principal: quem acumula cargo não tinha
                  como conferir na tela que os dois valem. */}
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                <Badge variant={profile.role}>
                  {NOME_DO_CARGO[profile.role] ?? profile.role}
                </Badge>
                {(profile.cargos || []).map((cargo) => (
                  <span
                    key={cargo}
                    title="Cargo adicional"
                    className="font-dm text-[10px] px-1.5 py-0.5 rounded-full text-cream/40"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    + {NOME_DO_CARGO[cargo] ?? cargo}
                  </span>
                ))}
              </div>
            </div>
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden"
              style={{ background: "rgba(200,75,49,0.12)", border: "1px solid rgba(200,75,49,0.2)" }}
            >
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <User className="h-4 w-4 text-accent" />
              )}
            </div>
            <button
              onClick={signOut}
              className="flex items-center justify-center h-10 w-10 sm:h-auto sm:w-auto sm:p-2 text-cream/40 hover:text-accent transition-colors"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
