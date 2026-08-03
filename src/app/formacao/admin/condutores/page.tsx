"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCondutores } from "@/hooks/useCondutores";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Shield,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  MessageCircle,
  UserCircle,
  Star,
  BarChart3,
  Users,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { toast } from "sonner";
import type { CertificadoCondutor, CertificadoSubmission } from "@/types";

type Vista = "ativos" | "arquivados";

export default function CondutoresPage() {
  const { isAdmin } = useAuth();
  const {
    data: condutores,
    loading: condutoresLoading,
    setData: setCondutores,
  } = useCondutores();
  const [search, setSearch] = useState("");
  const [vista, setVista] = useState<Vista>("ativos");
  const [extrasLoading, setExtrasLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newNome, setNewNome] = useState("");

  const [editTarget, setEditTarget] = useState<CertificadoCondutor | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editObservacoes, setEditObservacoes] = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [contas, setContas] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<CertificadoCondutor | null>(null);
  const [submissions, setSubmissions] = useState<CertificadoSubmission[]>([]);
  const [quorumByCondutor, setQuorumByCondutor] = useState<Record<string, { count: number; media: number }>>({});
  const router = useRouter();

  const loading = condutoresLoading || extrasLoading;

  useEffect(() => {
    async function fetchExtras() {
      const client = createClient();
      const [subRes, presRes] = await Promise.all([
        client.from("certificado_submissions").select("id,condutores,nota_condutor"),
        client.from("formacao_meet_presencas").select("condutor_nome, total_participantes, media_participantes"),
      ]);
      if (subRes.data) setSubmissions(subRes.data as CertificadoSubmission[]);

      // Aggregate quorum by conductor
      type PresencaQuorumRow = {
        condutor_nome: string | null;
        total_participantes: number | null;
      };
      const qMap: Record<string, { count: number; total: number }> = {};
      ((presRes.data || []) as PresencaQuorumRow[]).forEach((p) => {
        const nome = p.condutor_nome;
        if (!nome) return;
        if (!qMap[nome]) qMap[nome] = { count: 0, total: 0 };
        qMap[nome].count++;
        qMap[nome].total += p.total_participantes || 0;
      });
      const result: Record<string, { count: number; media: number }> = {};
      Object.entries(qMap).forEach(([nome, d]) => {
        result[nome] = { count: d.count, media: d.count > 0 ? d.total / d.count : 0 };
      });
      setQuorumByCondutor(result);

      // As contas que podem ser ligadas a uma ficha. Sem o vínculo, o cargo de
      // condutor não abre nada: a área do grupo procura a ficha por user_id.
      const { data: perfis } = await client
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true })
        .limit(2000);
      if (perfis) setContas(perfis);

      setExtrasLoading(false);
    }
    fetchExtras().catch(() => setExtrasLoading(false));
  }, []);

  const condutorStats = useMemo(() => {
    const map = new Map<string, { total: number; soma: number }>();
    submissions.forEach((s) => {
      (s.condutores || []).forEach((nome) => {
        const prev = map.get(nome) || { total: 0, soma: 0 };
        map.set(nome, { total: prev.total + 1, soma: prev.soma + s.nota_condutor });
      });
    });
    return map;
  }, [submissions]);

  const matchBusca = (c: CertificadoCondutor) =>
    c.nome.toLowerCase().includes(search.toLowerCase());

  const naVista = condutores.filter((c) =>
    vista === "arquivados" ? !!c.arquivado : !c.arquivado
  );
  const filtered = naVista.filter(matchBusca);
  const totalAtivos = condutores.filter((c) => !c.arquivado).length;
  const totalArquivados = condutores.length - totalAtivos;
  // quantos da outra aba a busca alcançaria — evita "não encontrado" enganoso
  const matchesNaOutraVista = condutores.filter(
    (c) => (vista === "arquivados" ? !c.arquivado : !!c.arquivado) && matchBusca(c)
  ).length;

  async function handleAdd() {
    const nome = newNome.trim();
    if (!nome) return;
    const existente = condutores.find(
      (c) => c.nome.toLowerCase() === nome.toLowerCase()
    );
    if (existente) {
      toast.error(
        existente.arquivado
          ? "Esse condutor já existe — está arquivado."
          : "Esse condutor já existe."
      );
      return;
    }
    setAdding(true);
    const client = createClient();
    const { data, error } = await client
      .from("certificado_condutores")
      .insert({ nome, ativo: true })
      .select("*")
      .single();

    if (error || !data) {
      toast.error("Erro ao adicionar condutor.");
      setAdding(false);
      return;
    }

    setCondutores((prev) =>
      [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome))
    );
    setNewNome("");
    setAdding(false);
    toast.success(`Condutor "${nome}" adicionado!`);
  }

  async function handleToggleAtivo(item: CertificadoCondutor) {
    const client = createClient();
    const { error } = await client
      .from("certificado_condutores")
      .update({ ativo: !item.ativo })
      .eq("id", item.id);

    if (error) {
      toast.error("Erro ao atualizar status.");
      return;
    }

    setCondutores((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, ativo: !c.ativo } : c))
    );
    toast.success(item.ativo ? "Condutor desativado." : "Condutor ativado.");
  }

  async function handleToggleArquivado(item: CertificadoCondutor) {
    const arquivando = !item.arquivado;
    // arquivar também desativa; desarquivar não reativa sozinho
    const patch = arquivando
      ? { arquivado: true, ativo: false }
      : { arquivado: false };

    const client = createClient();
    const { error } = await client
      .from("certificado_condutores")
      .update(patch)
      .eq("id", item.id);

    if (error) {
      // 42703 = coluna inexistente: migration 039 ainda não rodou no Supabase
      toast.error(
        error.code === "42703"
          ? "Falta rodar a migration 039 (coluna arquivado) no Supabase."
          : "Erro ao arquivar condutor."
      );
      return;
    }

    setCondutores((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, ...patch } : c))
    );
    toast.success(
      arquivando
        ? `"${item.nome}" arquivado.`
        : `"${item.nome}" restaurado — ative para usá-lo de novo.`
    );
  }

  function openEdit(item: CertificadoCondutor) {
    setEditTarget(item);
    setEditNome(item.nome);
    setEditTelefone(item.telefone || "");
    setEditObservacoes(item.observacoes || "");
    setEditUserId((item as { user_id?: string | null }).user_id || "");
  }

  async function handleEditSave() {
    if (!editTarget) return;
    const nome = editNome.trim();
    if (!nome) {
      toast.error("Nome é obrigatório.");
      return;
    }

    const client = createClient();
    const { error } = await client
      .from("certificado_condutores")
      .update({
        nome,
        telefone: editTelefone.trim() || null,
        observacoes: editObservacoes.trim() || null,
        user_id: editUserId || null,
      })
      .eq("id", editTarget.id);

    if (error) {
      toast.error("Erro ao salvar alterações.");
      return;
    }

    setCondutores((prev) =>
      prev
        .map((c) =>
          c.id === editTarget.id
            ? {
                ...c,
                nome,
                telefone: editTelefone.trim() || null,
                observacoes: editObservacoes.trim() || null,
        user_id: editUserId || null,
              }
            : c
        )
        .sort((a, b) => a.nome.localeCompare(b.nome))
    );
    setEditTarget(null);
    toast.success("Condutor atualizado!");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const client = createClient();
    const { error } = await client
      .from("certificado_condutores")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("Erro ao remover condutor.");
      return;
    }

    setCondutores((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Condutor removido.");
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="h-12 w-12 text-cream/20 mx-auto mb-4" />
        <h2 className="font-fraunces font-bold text-xl text-cream mb-2">
          Acesso restrito
        </h2>
        <p className="text-cream/40">
          Apenas administradores podem gerenciar condutores.
        </p>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
            Condutores
          </h1>
          <p className="text-sm text-cream/35 mt-1 font-dm">
            Gerencie os condutores disponíveis para certificados.
          </p>
        </div>
      </motion.div>

      {/* Add + Search */}
      <div
        className="flex flex-col sm:flex-row gap-3 mb-8 p-5 rounded-[16px]"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="relative flex-1">
          <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
          <input
            type="text"
            placeholder="Nome do novo condutor..."
            value={newNome}
            onChange={(e) => setNewNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm font-dm"
          />
        </div>
        <Button onClick={handleAdd} disabled={!newNome.trim() || adding} loading={adding}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Vista: em uso / arquivados */}
      <div className="flex flex-wrap gap-2 mb-4">
        {([
          { key: "ativos" as Vista, label: "Em uso", icon: UserCircle, count: totalAtivos },
          { key: "arquivados" as Vista, label: "Arquivados", icon: Archive, count: totalArquivados },
        ]).map(({ key, label, icon: Icon, count }) => {
          const active = vista === key;
          return (
            <button
              key={key}
              onClick={() => setVista(key)}
              className="font-dm text-xs px-3 py-2 sm:px-4 rounded-full flex items-center gap-1.5 transition-all min-h-[36px]"
              style={{
                backgroundColor: active ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
                color: active ? "#C84B31" : "rgba(253,251,247,0.4)",
                border: `1px solid ${active ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
        <input
          type="text"
          placeholder={vista === "arquivados" ? "Buscar arquivado..." : "Buscar condutor..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm font-dm"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-[12px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          {vista === "arquivados" ? (
            <Archive className="h-10 w-10 text-cream/15 mx-auto mb-3" />
          ) : (
            <UserCircle className="h-10 w-10 text-cream/15 mx-auto mb-3" />
          )}
          <p className="text-cream/35 text-sm font-dm">
            {search
              ? "Nenhum condutor encontrado."
              : vista === "arquivados"
                ? "Nenhum condutor arquivado."
                : "Nenhum condutor cadastrado."}
          </p>
          {search && matchesNaOutraVista > 0 && (
            <button
              onClick={() => setVista(vista === "arquivados" ? "ativos" : "arquivados")}
              className="mt-3 text-[11px] font-dm text-[#C84B31] hover:underline"
            >
              {matchesNaOutraVista} em{" "}
              {vista === "arquivados" ? "“Em uso”" : "“Arquivados”"} — ver lá
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[12px] group transition-all duration-200 hover:bg-white/[.02] gap-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-cream font-dm truncate">
                    {item.nome}
                  </p>
                  {item.arquivado ? (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium font-dm inline-flex items-center gap-1"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(253,251,247,0.3)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <Archive className="h-2.5 w-2.5" />
                      Arquivado
                    </span>
                  ) : (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium font-dm"
                      style={{
                        background: item.ativo
                          ? "rgba(46,158,143,0.1)"
                          : "rgba(255,255,255,0.04)",
                        color: item.ativo ? "#2E9E8F" : "rgba(253,251,247,0.3)",
                        border: item.ativo
                          ? "1px solid rgba(46,158,143,0.2)"
                          : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {item.ativo ? "Ativo" : "Inativo"}
                    </span>
                  )}
                  {(() => {
                    const s = condutorStats.get(item.nome);
                    if (!s || s.total === 0) return null;
                    const media = (s.soma / s.total).toFixed(1);
                    return (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium font-dm" style={{ background: "rgba(200,75,49,0.08)", color: "#C84B31", border: "1px solid rgba(200,75,49,0.15)" }}>
                        <Star className="h-2.5 w-2.5" />
                        {media} ({s.total})
                      </span>
                    );
                  })()}
                  {(() => {
                    const q = quorumByCondutor[item.nome];
                    if (!q || q.count === 0) return null;
                    return (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium font-dm" style={{ background: "rgba(108,92,231,0.08)", color: "rgba(108,92,231,0.7)", border: "1px solid rgba(108,92,231,0.15)" }}>
                        <Users className="h-2.5 w-2.5" />
                        {q.count}x · média {q.media.toFixed(1)}
                      </span>
                    );
                  })()}
                </div>
                {item.telefone && (
                  <p className="text-[11px] text-cream/30 mt-0.5 font-dm">{item.telefone}</p>
                )}
                {item.observacoes && (
                  <p className="text-[11px] text-cream/25 mt-0.5 font-dm truncate max-w-md">
                    {item.observacoes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => router.push(`/formacao/admin/condutores/${item.id}`)}
                  className="p-1.5 rounded-lg text-cream/20 hover:text-[#C84B31] hover:bg-[#C84B31]/10 transition-all"
                  aria-label="Ver feedbacks"
                  title="Ver feedbacks"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
                {item.telefone && (
                  <a
                    href={`https://wa.me/55${item.telefone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-cream/20 hover:text-green-400 hover:bg-green-400/10 transition-all"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
                {!item.arquivado && (
                  <button
                    onClick={() => handleToggleAtivo(item)}
                    className="p-1.5 rounded-lg text-cream/20 hover:text-cream/60 hover:bg-white/[.04] transition-all"
                    aria-label={item.ativo ? "Desativar" : "Ativar"}
                    title={item.ativo ? "Desativar" : "Ativar"}
                  >
                    {item.ativo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
                <button
                  onClick={() => handleToggleArquivado(item)}
                  className="p-1.5 rounded-lg text-cream/20 hover:text-[#D4A857] hover:bg-[#D4A857]/10 transition-all"
                  aria-label={item.arquivado ? "Desarquivar" : "Arquivar"}
                  title={
                    item.arquivado
                      ? "Desarquivar"
                      : "Arquivar (some da lista, sem apagar o histórico)"
                  }
                >
                  {item.arquivado ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => openEdit(item)}
                  className="p-1.5 rounded-lg text-cream/20 hover:text-[#C84B31] hover:bg-[#C84B31]/10 transition-all"
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(item)}
                  className="p-1.5 rounded-lg text-cream/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar condutor">
        {editTarget && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-cream/40 font-dm mb-1 block">Nome</label>
              <input
                type="text"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="w-full px-4 py-2.5 dark-input rounded-[10px] text-sm font-dm"
              />
            </div>
            <div>
              <label className="text-xs text-cream/40 font-dm mb-1 block">Telefone</label>
              <input
                type="text"
                value={editTelefone}
                onChange={(e) => setEditTelefone(e.target.value)}
                placeholder="11999999999"
                className="w-full px-4 py-2.5 dark-input rounded-[10px] text-sm font-dm"
              />
            </div>
            <div>
              <label className="text-xs text-cream/40 font-dm mb-1 block">Observações</label>
              <textarea
                value={editObservacoes}
                onChange={(e) => setEditObservacoes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 dark-input rounded-[10px] text-sm font-dm resize-none"
              />
            </div>

            {/* O elo que faltava.
                Todo o resto do sistema casa condutor por semelhança de nome, o
                que serve para estatística e não para permissão: dois nomes
                iguais, ou um apelido diferente no Meet, já bastariam para
                alguém abrir o grupo de outra pessoa. Aqui a ligação é
                explícita, e é ela que abre a área "Meu grupo". */}
            <div>
              <label className="text-xs text-cream/40 font-dm mb-1 block">
                Conta desta pessoa
              </label>
              <select
                value={editUserId}
                onChange={(e) => setEditUserId(e.target.value)}
                className="w-full px-4 py-2.5 dark-input rounded-[10px] text-sm font-dm"
                style={{ background: "#1A1A1A", color: "#FDFBF7" }}
              >
                <option value="" style={{ background: "#1A1A1A", color: "#FDFBF7" }}>
                  sem conta ligada
                </option>
                {contas.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    style={{ background: "#1A1A1A", color: "#FDFBF7" }}
                  >
                    {c.full_name || c.email} {c.email ? `· ${c.email}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-cream/30 mt-1.5">
                Sem isso a pessoa não consegue abrir a área do próprio grupo. O cargo
                &quot;Condutor&quot; também precisa estar marcado em Configurações.
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setEditTarget(null)}>
                Cancelar
              </Button>
              <Button onClick={handleEditSave}>Salvar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remover condutor">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-cream/50 font-dm">
              Tem certeza que deseja remover{" "}
              <span className="font-medium text-cream">"{deleteTarget.nome}"</span>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Remover
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
