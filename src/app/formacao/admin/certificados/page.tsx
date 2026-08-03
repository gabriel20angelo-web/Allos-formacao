"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import { Search, ChevronDown, Award, Clock } from "lucide-react";
import PessoaModal, { type PessoaRef } from "@/components/admin/dashboard/PessoaModal";
import VerificacoesTab from "@/components/admin/certificados/VerificacoesTab";
import OcorrenciasTab from "@/components/admin/certificados/OcorrenciasTab";
import { formatDate } from "@/lib/utils/format";
import type { Certificate } from "@/types";

const CertFormacaoPage = dynamic(() => import("@/app/formacao/admin/certificados-formacao/page"), { ssr: false });
const EnviosPage = dynamic(() => import("@/app/formacao/admin/envios/page"), { ssr: false });
const CertAvulsoPage = dynamic(() => import("@/app/formacao/admin/certificado-avulso/page"), { ssr: false });

interface CourseOption {
  id: string;
  title: string;
}

interface Pendente {
  id: string;
  completed_at: string;
  nome: string;
  email: string;
  curso: string;
}

export default function AdminCertificadosPage() {
  const { profile, isAdmin } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"cursos" | "formacao" | "envios" | "avulso" | "verificacoes" | "ocorrencias">("cursos");

  // Concluiu o curso mas não gerou o PDF: a emissão depende de um clique do
  // aluno, então "sem certificado" não quer dizer "não terminou".
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [subView, setSubView] = useState<"emitidos" | "pendentes">("emitidos");
  const [pessoaAberta, setPessoaAberta] = useState<PessoaRef | null>(null);

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    async function load() {
      if (!profile) {
        setLoading(false);
        return;
      }
      const supabase = createClient();

      const [certRes, coursesRes, concluidasRes] = await Promise.all([
        supabase
          .from("certificates")
          .select(`
            *,
            user:profiles!certificates_user_id_fkey(full_name, email),
            course:courses!certificates_course_id_fkey(id, title, instructor_id)
          `)
          .order("issued_at", { ascending: false }),
        supabase
          .from("courses")
          .select("id, title")
          .order("title"),
        supabase
          .from("enrollments")
          .select(
            "id, user_id, course_id, completed_at, user:profiles!user_id(full_name, email), course:courses!course_id(title, instructor_id)"
          )
          .eq("status", "completed")
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false }),
      ]);

      if (certRes.data) {
        const filtered = isAdmin
          ? certRes.data
          : certRes.data.filter((c) => c.course?.instructor_id === profile.id);
        setCertificates(filtered);
      }
      if (coursesRes.data) setCourses(coursesRes.data as CourseOption[]);

      // Pendente = concluiu o curso e não existe certificado dessa pessoa nele.
      type ConcluidaRow = {
        id: string;
        user_id: string;
        course_id: string;
        completed_at: string;
        user?: { full_name: string | null; email: string | null } | null;
        course?: { title: string | null; instructor_id: string | null } | null;
      };
      const emitidos = new Set(
        (certRes.data ?? []).map(
          (c: { user_id: string; course_id: string }) =>
            `${c.user_id}|${c.course_id}`
        )
      );
      const concluidas = (
        (concluidasRes.data ?? []) as unknown as ConcluidaRow[]
      ).filter((e) => (isAdmin ? true : e.course?.instructor_id === profile.id));
      setPendentes(
        concluidas
          .filter((e) => !emitidos.has(`${e.user_id}|${e.course_id}`))
          .map((e) => ({
            id: e.id,
            completed_at: e.completed_at,
            nome: e.user?.full_name || "Aluno",
            email: e.user?.email || "",
            curso: e.course?.title || "Curso",
          }))
      );

      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [profile, isAdmin]);

  const filtered = useMemo(() => {
    let result = certificates;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.user?.full_name?.toLowerCase().includes(s) ||
          c.user?.email?.toLowerCase().includes(s) ||
          c.course?.title?.toLowerCase().includes(s)
      );
    }

    if (selectedCourseId !== "all") {
      result = result.filter((c) => c.course_id === selectedCourseId);
    }

    if (dateFrom) {
      result = result.filter((c) => c.issued_at >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((c) => c.issued_at <= dateTo + "T23:59:59.999Z");
    }

    return result;
  }, [certificates, search, selectedCourseId, dateFrom, dateTo]);

  const uniqueCourses = useMemo(() => {
    const ids = new Set(certificates.map((c) => c.course_id));
    return ids.size;
  }, [certificates]);

  // os mesmos filtros de cima valem para quem concluiu sem emitir
  const pendentesFiltrados = useMemo(() => {
    let result = pendentes;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.nome.toLowerCase().includes(s) ||
          p.email.toLowerCase().includes(s) ||
          p.curso.toLowerCase().includes(s)
      );
    }
    if (dateFrom) result = result.filter((p) => p.completed_at >= dateFrom);
    if (dateTo)
      result = result.filter((p) => p.completed_at <= dateTo + "T23:59:59.999Z");
    return result;
  }, [pendentes, search, dateFrom, dateTo]);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-40 mb-8" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
          Certificados
        </h1>
        <p className="text-sm text-cream/35 mt-1">
          Certificados emitidos na plataforma.
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            onClick={() => setView("cursos")}
            className="font-dm text-xs px-4 py-2 rounded-full transition-all"
            style={{
              backgroundColor: view === "cursos" ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
              color: view === "cursos" ? "#C84B31" : "rgba(253,251,247,0.4)",
              border: `1px solid ${view === "cursos" ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            Cursos
          </button>
          <button
            onClick={() => setView("formacao")}
            className="font-dm text-xs px-4 py-2 rounded-full transition-all"
            style={{
              backgroundColor: view === "formacao" ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
              color: view === "formacao" ? "#C84B31" : "rgba(253,251,247,0.4)",
              border: `1px solid ${view === "formacao" ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            Formação
          </button>
          <button
            onClick={() => setView("envios")}
            className="font-dm text-xs px-4 py-2 rounded-full transition-all"
            style={{
              backgroundColor: view === "envios" ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
              color: view === "envios" ? "#C84B31" : "rgba(253,251,247,0.4)",
              border: `1px solid ${view === "envios" ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            Envios
          </button>
          <button
            onClick={() => setView("avulso")}
            className="font-dm text-xs px-4 py-2 rounded-full transition-all"
            style={{
              backgroundColor: view === "avulso" ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
              color: view === "avulso" ? "#C84B31" : "rgba(253,251,247,0.4)",
              border: `1px solid ${view === "avulso" ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            Avulso
          </button>
          <button
            onClick={() => setView("verificacoes")}
            className="font-dm text-xs px-4 py-2 rounded-full transition-all"
            style={{
              backgroundColor: view === "verificacoes" ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
              color: view === "verificacoes" ? "#C84B31" : "rgba(253,251,247,0.4)",
              border: `1px solid ${view === "verificacoes" ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            Verificações
          </button>
          <button
            onClick={() => setView("ocorrencias")}
            className="font-dm text-xs px-4 py-2 rounded-full transition-all"
            style={{
              backgroundColor: view === "ocorrencias" ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
              color: view === "ocorrencias" ? "#C84B31" : "rgba(253,251,247,0.4)",
              border: `1px solid ${view === "ocorrencias" ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            Ocorrências
          </button>
        </div>
      </motion.div>

      {view === "formacao" && <CertFormacaoPage />}
      {view === "envios" && <EnviosPage />}
      {view === "avulso" && <CertAvulsoPage />}
      {view === "verificacoes" && <VerificacoesTab onPersonClick={setPessoaAberta} />}
      {view === "ocorrencias" && <OcorrenciasTab onPersonClick={setPessoaAberta} />}

      {view === "cursos" && (<>
      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap items-center gap-3 mb-6 px-4 py-3 rounded-[12px]"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={() => setSubView("emitidos")}
          className="flex items-center gap-2 transition-opacity"
          style={{ opacity: subView === "emitidos" ? 1 : 0.45 }}
        >
          <Award className="h-4 w-4 text-accent" />
          <span className="text-sm text-cream/60">
            <span className="text-cream font-semibold">{certificates.length}</span> certificado{certificates.length !== 1 ? "s" : ""} emitido{certificates.length !== 1 ? "s" : ""}
          </span>
        </button>
        <span className="text-cream/15">·</span>
        <button
          onClick={() => setSubView("pendentes")}
          className="flex items-center gap-2 transition-opacity"
          style={{ opacity: subView === "pendentes" ? 1 : 0.45 }}
          title="Terminaram o curso mas ainda não geraram o PDF do certificado"
        >
          <Clock className="h-4 w-4" style={{ color: "#F59E0B" }} />
          <span className="text-sm text-cream/60">
            <span className="text-cream font-semibold">{pendentes.length}</span> concluíram sem emitir
          </span>
        </button>
        <span className="text-cream/15">·</span>
        <span className="text-sm text-cream/60">
          <span className="text-cream font-semibold">{uniqueCourses}</span> curso{uniqueCourses !== 1 ? "s" : ""}
        </span>
      </motion.div>

      {/* Filters row */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 mb-6"
      >
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
          <input
            type="text"
            placeholder="Buscar por aluno, email ou curso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm"
            aria-label="Buscar certificados"
          />
        </div>

        <div className="relative w-full sm:w-auto">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="appearance-none w-full sm:w-auto pl-4 pr-9 py-2.5 rounded-[10px] text-sm text-cream bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/40"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <option value="all" className="bg-[#1a1a1a] text-cream">Todos os cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#1a1a1a] text-cream">
                {c.title}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream/30 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex flex-col flex-1 sm:flex-none">
            <label className="text-[10px] text-cream/30 mb-1 uppercase tracking-wider">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-[10px] text-sm text-cream bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/40"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
            />
          </div>
          <div className="flex flex-col flex-1 sm:flex-none">
            <label className="text-[10px] text-cream/30 mb-1 uppercase tracking-wider">Até</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-[10px] text-sm text-cream bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/40"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
            />
          </div>
        </div>
      </motion.div>

      {/* Concluíram sem emitir */}
      {subView === "pendentes" && (
        <div
          className="rounded-[16px] overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="px-4 py-3 text-xs text-cream/35 leading-snug" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            Terminaram o curso mas não geraram o PDF — a emissão depende de um
            clique do aluno, então isto não é pendência sua, é quem ainda pode
            receber o certificado.
          </p>
          {pendentesFiltrados.length === 0 ? (
            <p className="px-4 py-8 text-center text-cream/35 text-sm">
              Ninguém concluiu curso sem emitir certificado.
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              {pendentesFiltrados.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <button
                    onClick={() => setPessoaAberta({ nome: p.nome, email: p.email })}
                    className="text-sm text-cream hover:underline decoration-dotted underline-offset-2"
                  >
                    {p.nome}
                  </button>
                  <span className="text-xs text-cream/35">{p.email}</span>
                  <span className="text-xs text-cream/50">{p.curso}</span>
                  <div className="flex-1" />
                  <span className="text-xs text-cream/30">
                    concluiu em {formatDate(p.completed_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabela — visível só no desktop */}
      {subView === "emitidos" && (
      <div
        className="hidden md:block rounded-[16px] overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <th className="text-left px-4 py-3 font-semibold text-cream/50">Aluno</th>
                <th className="text-left px-4 py-3 font-semibold text-cream/50">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-cream/50">Curso</th>
                <th className="text-left px-4 py-3 font-semibold text-cream/50">Emissão</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cert) => (
                <tr
                  key={cert.id}
                  className="hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <td className="px-4 py-3 text-cream">
                    <button
                      onClick={() =>
                        setPessoaAberta({
                          nome: cert.user?.full_name || "Aluno",
                          email: cert.user?.email || undefined,
                        })
                      }
                      className="hover:underline decoration-dotted underline-offset-2"
                      title="Ver tudo o que essa pessoa fez"
                    >
                      {cert.user?.full_name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-cream/40">{cert.user?.email}</td>
                  <td className="px-4 py-3 text-cream/40">{cert.course?.title}</td>
                  <td className="px-4 py-3 text-cream/30 text-xs">{formatDate(cert.issued_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-cream/35">
                    Nenhum certificado encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Cards — visíveis só no mobile */}
      {subView === "emitidos" && (
      <div className="md:hidden space-y-3">
        {filtered.map((cert) => (
          <div
            key={cert.id}
            className="rounded-[14px] p-3.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm text-cream font-medium leading-snug">{cert.user?.full_name}</span>
              <span className="text-xs text-cream/30 whitespace-nowrap shrink-0">{formatDate(cert.issued_at)}</span>
            </div>
            <p className="text-xs text-cream/40 mb-1 truncate">{cert.user?.email}</p>
            <p className="text-xs text-cream/50">{cert.course?.title}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-cream/35 py-8 text-sm">
            Nenhum certificado encontrado.
          </p>
        )}
      </div>
      )}
      </>)}

      <PessoaModal pessoa={pessoaAberta} onClose={() => setPessoaAberta(null)} />
    </div>
  );
}
