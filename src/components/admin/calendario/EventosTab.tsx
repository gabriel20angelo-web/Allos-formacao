"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CalendarDays,
  Infinity as InfinityIcon,
} from "lucide-react";
import type { CertificadoEvento } from "@/types";

const TABLE = "certificado_eventos";
const EMPTY_FORM = {
  titulo: "",
  descricao: "",
  link: "",
  data_inicio: "",
  data_fim: "",
  permanente: false,
};

export default function EventosTab() {
  const [eventos, setEventos] = useState<CertificadoEvento[]>([]);
  const [eventoForm, setEventoForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CertificadoEvento | null>(
    null
  );

  // Fetch initial events. Antes do select, desativa em massa os eventos
  // vencidos não-permanentes (ativo=true & permanente=false & data_fim<now).
  // Eventos permanentes ficam ativos até serem desligados manualmente.
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const nowIso = new Date().toISOString();
      await supabase
        .from(TABLE)
        .update({ ativo: false })
        .eq("ativo", true)
        .eq("permanente", false)
        .lt("data_fim", nowIso);
      const { data } = await supabase
        .from(TABLE)
        .select("*")
        .order("data_inicio", { ascending: false });
      if (data) setEventos(data as CertificadoEvento[]);
    })();
  }, []);

  async function handleAdd() {
    if (
      !eventoForm.titulo.trim() ||
      !eventoForm.data_inicio ||
      !eventoForm.data_fim
    ) {
      toast.error("Preencha título, data de início e data de fim.");
      return;
    }
    setAdding(true);
    const supabase = createClient();
    // datetime-local entrega "2026-05-05T13:00" sem timezone. Postgres
    // timestamptz interpretaria como UTC; convertemos com `new Date()`
    // (que assume timezone local do navegador) e exportamos pra ISO UTC,
    // garantindo que o horário gravado bata com o que o admin viu.
    const dataInicioIso = new Date(eventoForm.data_inicio).toISOString();
    const dataFimIso = new Date(eventoForm.data_fim).toISOString();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        titulo: eventoForm.titulo.trim(),
        descricao: eventoForm.descricao.trim() || null,
        link: eventoForm.link.trim() || null,
        data_inicio: dataInicioIso,
        data_fim: dataFimIso,
        ativo: true,
        permanente: eventoForm.permanente,
      })
      .select("*")
      .single();
    if (error || !data) {
      toast.error("Erro ao criar evento.");
      setAdding(false);
      return;
    }
    setEventos((prev) => [data, ...prev]);
    setEventoForm(EMPTY_FORM);
    setAdding(false);
    toast.success("Evento criado!");
  }

  async function toggleEvento(id: string, ativo: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from(TABLE).update({ ativo }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar evento.");
      return;
    }
    setEventos((prev) => prev.map((e) => (e.id === id ? { ...e, ativo } : e)));
  }

  async function togglePermanente(id: string, permanente: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ permanente })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar evento.");
      return;
    }
    setEventos((prev) =>
      prev.map((e) => (e.id === id ? { ...e, permanente } : e))
    );
    toast.success(
      permanente
        ? "Evento marcado como permanente."
        : "Evento sem permanência: vai desativar quando o horário acabar."
    );
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover evento.");
      return;
    }
    setEventos((prev) => prev.filter((e) => e.id !== id));
    setDeleteTarget(null);
    toast.success("Evento removido!");
  }

  return (
    <motion.div
      key="eventos"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* Create form */}
      <div className="p-5 rounded-xl space-y-4 bg-surface-2 border border-border-soft">
        <h3 className="font-fraunces font-semibold text-base text-cream">
          Novo Evento
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Título"
            value={eventoForm.titulo}
            onChange={(e) =>
              setEventoForm((f) => ({ ...f, titulo: e.target.value }))
            }
            className="px-3 py-2 rounded-lg text-sm font-dm col-span-full bg-white/5 border border-white/10 text-cream"
          />
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={eventoForm.descricao}
            onChange={(e) =>
              setEventoForm((f) => ({ ...f, descricao: e.target.value }))
            }
            className="px-3 py-2 rounded-lg text-sm font-dm col-span-full bg-white/5 border border-white/10 text-cream"
          />
          <input
            type="url"
            placeholder="Link do evento (YouTube, Meet, etc.)"
            value={eventoForm.link}
            onChange={(e) =>
              setEventoForm((f) => ({ ...f, link: e.target.value }))
            }
            className="px-3 py-2 rounded-lg text-sm font-dm col-span-full bg-white/5 border border-white/10 text-cream"
          />
          <div className="space-y-1">
            <label className="text-xs font-dm text-cream-40">Início</label>
            <input
              type="datetime-local"
              value={eventoForm.data_inicio}
              onChange={(e) =>
                setEventoForm((f) => ({ ...f, data_inicio: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg text-sm font-dm bg-white/5 border border-white/10 text-cream"
              style={{ colorScheme: "dark" }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-dm text-cream-40">Fim</label>
            <input
              type="datetime-local"
              value={eventoForm.data_fim}
              onChange={(e) =>
                setEventoForm((f) => ({ ...f, data_fim: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg text-sm font-dm bg-white/5 border border-white/10 text-cream"
              style={{ colorScheme: "dark" }}
            />
          </div>
          <label className="col-span-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer select-none hover:bg-white/[0.07] transition-colors">
            <input
              type="checkbox"
              checked={eventoForm.permanente}
              onChange={(e) =>
                setEventoForm((f) => ({ ...f, permanente: e.target.checked }))
              }
              className="mt-0.5 accent-amber-400"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <InfinityIcon className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-sm font-dm font-medium text-cream">
                  Manter ativo permanentemente
                </span>
              </div>
              <p className="text-[11px] font-dm text-cream-40 mt-0.5">
                Eventos permanentes ficam ativos mesmo depois do horário acabar
                — só desligam quando você clicar em &quot;Inativo&quot;.
              </p>
            </div>
          </label>
        </div>
        <Button size="sm" onClick={handleAdd} loading={adding}>
          <Plus className="h-4 w-4" />
          Criar Evento
        </Button>
      </div>

      {/* Events list */}
      <div className="space-y-2">
        {eventos.map((evento) => (
          <motion.div
            key={evento.id}
            layout
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 rounded-xl bg-surface-2 border gap-3 ${
              evento.permanente
                ? "border-amber-400/30"
                : "border-border-soft"
            } ${evento.ativo ? "" : "opacity-50"}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CalendarDays
                  className={`h-4 w-4 flex-shrink-0 ${
                    evento.permanente ? "text-amber-400" : "text-accent"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-sm font-dm font-semibold truncate text-cream">
                  {evento.titulo}
                </span>
                {evento.permanente && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-dm font-medium bg-amber-400/15 text-amber-300 flex-shrink-0">
                    <InfinityIcon className="h-2.5 w-2.5" />
                    Permanente
                  </span>
                )}
              </div>
              {evento.descricao && (
                <p className="text-xs font-dm mt-0.5 ml-6 truncate text-cream-40">
                  {evento.descricao}
                </p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 ml-6 mt-1">
                <span className="text-[10px] font-dm text-cream-30">
                  Início:{" "}
                  {new Date(evento.data_inicio).toLocaleString("pt-BR")}
                </span>
                <span className="text-[10px] font-dm text-cream-30">
                  Fim: {new Date(evento.data_fim).toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <button
                onClick={() =>
                  togglePermanente(evento.id, !evento.permanente)
                }
                title={
                  evento.permanente
                    ? "Permanente: não desativa quando o horário acabar"
                    : "Marcar como permanente (não desativa automaticamente)"
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-dm transition-colors border ${
                  evento.permanente
                    ? "bg-amber-400/15 text-amber-300 border-amber-400/30"
                    : "bg-white/5 text-cream-40 border-border-soft"
                }`}
              >
                <InfinityIcon className="h-3 w-3" />
                {evento.permanente ? "Permanente" : "Temporário"}
              </button>
              <button
                onClick={() => toggleEvento(evento.id, !evento.ativo)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-dm transition-colors border border-border-soft ${
                  evento.ativo
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-white/5 text-cream-40"
                }`}
              >
                {evento.ativo ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
                {evento.ativo ? "Ativo" : "Inativo"}
              </button>
              <button
                onClick={() => setDeleteTarget(evento)}
                className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                aria-label="Remover evento"
              >
                <Trash2 className="h-4 w-4 text-red-400/60" />
              </button>
            </div>
          </motion.div>
        ))}

        {eventos.length === 0 && (
          <div className="text-center py-16">
            <CalendarDays
              className="h-8 w-8 mx-auto mb-3 text-cream/15"
              aria-hidden="true"
            />
            <p className="text-sm font-dm text-cream-40">
              Nenhum evento cadastrado.
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        title="Remover Evento"
        confirmLabel="Remover"
        variant="danger"
        description={
          <p className="font-dm">
            Deseja remover o evento{" "}
            <strong className="text-cream">
              &quot;{deleteTarget?.titulo}&quot;
            </strong>
            ? Esta ação não pode ser desfeita.
          </p>
        }
      />
    </motion.div>
  );
}
