"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Star,
  Activity,
  MessageSquare,
  TrendingUp,
  Calendar,
  ChevronDown,
  UserCircle,
  Users,
} from "lucide-react";
import type { CertificadoCondutor, CertificadoSubmission } from "@/types";

interface AtividadeStats {
  nome: string;
  notaMedia: number;
  totalSessoes: number;
  feedbacks: {
    nome_completo: string;
    nota_condutor: number;
    nota_grupo: number;
    relato: string | null;
    created_at: string;
  }[];
}

export default function CondutorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [condutor, setCondutor] = useState<CertificadoCondutor | null>(null);
  const [submissions, setSubmissions] = useState<CertificadoSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAtividade, setExpandedAtividade] = useState<string | null>(null);
  const [quorumData, setQuorumData] = useState<{ count: number; media: number; pico: number; porAtividade: Record<string, { count: number; media: number }> } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const condRes = await supabase
        .from("certificado_condutores")
        .select("*")
        .eq("id", id)
        .single();

      if (condRes.data) {
        setCondutor(condRes.data);
        // Fetch submissions + meet presencas in parallel
        const [{ data: subs }, { data: presencas }] = await Promise.all([
          supabase
            .from("certificado_submissions")
            .select("*")
            .contains("condutores", [condRes.data.nome])
            .order("created_at", { ascending: false }),
          supabase
            .from("formacao_meet_presencas")
            .select("atividade_nome, total_participantes, media_participantes, pico_participantes")
            .eq("condutor_nome", condRes.data.nome),
        ]);
        if (subs) setSubmissions(subs);

        // Quorum aggregation
        type PresencaRow = {
          atividade_nome: string | null;
          total_participantes: number | null;
          media_participantes: number | null;
          pico_participantes: number | null;
        };
        const rows = (presencas ?? []) as PresencaRow[];
        if (rows.length > 0) {
          const count = rows.length;
          const media = rows.reduce((s, p) => s + (p.media_participantes || 0), 0) / count;
          const pico = Math.max(...rows.map((p) => p.pico_participantes || 0));
          const porAtividade: Record<string, { count: number; total: number }> = {};
          rows.forEach((p) => {
            const nome = p.atividade_nome || "Sem atividade";
            if (!porAtividade[nome]) porAtividade[nome] = { count: 0, total: 0 };
            porAtividade[nome].count++;
            porAtividade[nome].total += p.total_participantes || 0;
          });
          const porAtividadeResult: Record<string, { count: number; media: number }> = {};
          Object.entries(porAtividade).forEach(([n, d]) => {
            porAtividadeResult[n] = { count: d.count, media: d.count > 0 ? d.total / d.count : 0 };
          });
          setQuorumData({ count, media, pico, porAtividade: porAtividadeResult });
        }
      }
      setLoading(false);
    }
    if (id) load().catch(() => setLoading(false));
  }, [id]);

  const stats = useMemo(() => {
    if (submissions.length === 0)
      return { notaMedia: 0, totalAvaliacoes: 0, porAtividade: [] as AtividadeStats[] };

    const totalAvaliacoes = submissions.length;
    const notaMedia =
      submissions.reduce((sum, s) => sum + s.nota_condutor, 0) / totalAvaliacoes;

    // Group by activity
    const atvMap = new Map<string, AtividadeStats>();
    submissions.forEach((s) => {
      if (!atvMap.has(s.atividade_nome)) {
        atvMap.set(s.atividade_nome, { nome: s.atividade_nome, notaMedia: 0, totalSessoes: 0, feedbacks: [] });
      }
      const a = atvMap.get(s.atividade_nome)!;
      a.totalSessoes++;
      a.feedbacks.push({
        nome_completo: s.nome_completo,
        nota_condutor: s.nota_condutor,
        nota_grupo: s.nota_grupo,
        relato: s.relato,
        created_at: s.created_at,
      });
    });

    const porAtividade = Array.from(atvMap.values())
      .map((a) => ({
        ...a,
        notaMedia: a.feedbacks.reduce((sum, f) => sum + f.nota_condutor, 0) / a.totalSessoes,
      }))
      .sort((a, b) => b.totalSessoes - a.totalSessoes);

    return { notaMedia, totalAvaliacoes, porAtividade };
  }, [submissions]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-dm text-[#FDFBF7]/50">Acesso restrito.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!condutor) {
    return (
      <div className="text-center py-20">
        <UserCircle className="h-10 w-10 text-[#FDFBF7]/15 mx-auto mb-3" />
        <p className="text-[#FDFBF7]/40 font-dm">Condutor não encontrado.</p>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mt-4">
          <ArrowLeft size={16} className="mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/formacao/admin/condutores")}
          className="p-2 rounded-lg text-[#FDFBF7]/40 hover:text-[#FDFBF7] hover:bg-[rgba(255,255,255,0.04)] transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold font-dm"
            style={{ background: "rgba(200,75,49,0.1)", color: "#C84B31" }}
          >
            {condutor.nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-fraunces font-semibold text-[#FDFBF7]">
              {condutor.nome}
            </h1>
            <p className="text-sm text-[#FDFBF7]/40 font-dm">
              {condutor.ativo ? "Ativo" : "Inativo"}
              {condutor.telefone && ` · ${condutor.telefone}`}
            </p>
          </div>
        </div>
      </div>

      {condutor.observacoes && (
        <p className="text-sm text-[#FDFBF7]/50 font-dm pl-14">{condutor.observacoes}</p>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Star size={16} className="text-[#C84B31]" />
            <span className="text-xs text-[#FDFBF7]/40 font-dm">Nota Média</span>
          </div>
          <p className="text-3xl font-fraunces font-bold text-[#FDFBF7]">
            {stats.notaMedia > 0 ? stats.notaMedia.toFixed(1) : "—"}
          </p>
        </div>

        <div className="p-5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-[#C84B31]" />
            <span className="text-xs text-[#FDFBF7]/40 font-dm">Total de Avaliações</span>
          </div>
          <p className="text-3xl font-fraunces font-bold text-[#FDFBF7]">
            {stats.totalAvaliacoes}
          </p>
        </div>

        <div className="p-5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Activity size={16} className="text-[#C84B31]" />
            <span className="text-xs text-[#FDFBF7]/40 font-dm">Atividades Conduzidas</span>
          </div>
          <p className="text-3xl font-fraunces font-bold text-[#FDFBF7]">
            {stats.porAtividade.length}
          </p>
        </div>
      </div>

      {/* Quorum do Meet */}
      {quorumData && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: "rgba(108,92,231,0.04)", border: "1px solid rgba(108,92,231,0.12)" }}>
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: "#6c5ce7" }} />
            <h2 className="text-sm font-fraunces font-semibold text-[#FDFBF7]">Quórum do Meet</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-fraunces font-bold text-[#FDFBF7]">{quorumData.count}</p>
              <p className="text-[10px] text-[#FDFBF7]/35 font-dm">Grupos registrados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-fraunces font-bold text-[#FDFBF7]">{quorumData.media.toFixed(1)}</p>
              <p className="text-[10px] text-[#FDFBF7]/35 font-dm">Média de participantes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-fraunces font-bold text-[#FDFBF7]">{quorumData.pico}</p>
              <p className="text-[10px] text-[#FDFBF7]/35 font-dm">Pico máximo</p>
            </div>
          </div>
          {Object.keys(quorumData.porAtividade).length > 1 && (
            <div className="space-y-1.5 pt-2" style={{ borderTop: "1px solid rgba(108,92,231,0.1)" }}>
              <p className="text-[10px] text-[#FDFBF7]/30 font-dm uppercase tracking-wider">Por atividade</p>
              {Object.entries(quorumData.porAtividade)
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([nome, d]) => (
                  <div key={nome} className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <span className="font-dm text-xs text-[#FDFBF7]/60">{nome}</span>
                    <span className="font-dm text-xs text-[#FDFBF7]/40">{d.count}x · média {d.media.toFixed(1)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Per-activity breakdown */}
      <div>
        <h2 className="text-lg font-fraunces font-semibold text-[#FDFBF7] mb-4 flex items-center gap-2">
          <Activity size={18} className="text-[#C84B31]" />
          Por Atividade
        </h2>

        {stats.porAtividade.length === 0 ? (
          <p className="text-sm text-[#FDFBF7]/30 font-dm">Nenhuma avaliação ainda.</p>
        ) : (
          <div className="space-y-3">
            {stats.porAtividade.map((a) => {
              const isExp = expandedAtividade === a.nome;
              return (
                <div
                  key={a.nome}
                  className="rounded-xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <button
                    onClick={() => setExpandedAtividade(isExp ? null : a.nome)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#FDFBF7] font-dm">{a.nome}</p>
                      <p className="text-xs text-[#FDFBF7]/40 font-dm">
                        {a.totalSessoes} sessão{a.totalSessoes !== 1 ? "ões" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#FDFBF7] font-dm">{a.notaMedia.toFixed(1)}</p>
                        <p className="text-[10px] text-[#FDFBF7]/30 font-dm">média</p>
                      </div>
                      <ChevronDown size={16} className={`text-[#FDFBF7]/30 transition-transform ${isExp ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2 border-t border-[rgba(255,255,255,0.06)]">
                          <div className="pt-3" />
                          {a.feedbacks.map((f, i) => (
                            <div key={i} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-[#FDFBF7]/70 font-dm">{f.nome_completo}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-dm">
                                    <span className="text-[#FDFBF7]/30">condutor </span>
                                    <span className="text-[#C84B31] font-bold">{f.nota_condutor}/10</span>
                                  </span>
                                  <span className="text-xs font-dm">
                                    <span className="text-[#FDFBF7]/30">grupo </span>
                                    <span className="text-[#FDFBF7]/60 font-bold">{f.nota_grupo}/10</span>
                                  </span>
                                  <span className="text-[10px] text-[#FDFBF7]/30 font-dm">
                                    {new Date(f.created_at).toLocaleDateString("pt-BR")}
                                  </span>
                                </div>
                              </div>
                              {f.relato && (
                                <p className="text-xs text-[#FDFBF7]/50 font-dm leading-relaxed mt-1">{f.relato}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All feedbacks */}
      <div>
        <h2 className="text-lg font-fraunces font-semibold text-[#FDFBF7] mb-4 flex items-center gap-2">
          <MessageSquare size={18} className="text-[#C84B31]" />
          Todos os Feedbacks ({submissions.length})
        </h2>

        {submissions.length === 0 ? (
          <p className="text-sm text-[#FDFBF7]/30 font-dm">Nenhum feedback recebido ainda.</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-[#FDFBF7] font-dm">{s.nome_completo}</p>
                    <p className="text-xs text-[#FDFBF7]/40 font-dm">{s.atividade_nome}</p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-xs text-[#FDFBF7]/30 font-dm">Condutor</p>
                      <p className="text-sm font-bold text-[#C84B31] font-dm">{s.nota_condutor}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#FDFBF7]/30 font-dm">Grupo</p>
                      <p className="text-sm font-bold text-[#FDFBF7]/70 font-dm">{s.nota_grupo}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={12} className="text-[#FDFBF7]/30" />
                      <span className="text-xs text-[#FDFBF7]/40 font-dm">
                        {new Date(s.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </div>
                {s.relato && (
                  <p className="text-sm text-[#FDFBF7]/50 font-dm leading-relaxed">
                    &ldquo;{s.relato}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
