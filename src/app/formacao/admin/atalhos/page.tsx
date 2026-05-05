"use client";

// Admin de atalhos publicos: /formacao/<slug> -> URL externa.
// Tabela study_links (migration 033). RPC resolve_study_link incrementa clicks.
// Usuario gerencia aqui em vez de no formulario de cada curso.

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, Copy, ExternalLink, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import {
  validateStudyLinkSlug,
  validateStudyLinkUrl,
} from "@/lib/utils/studyLink";

interface StudyLink {
  id: string;
  slug: string;
  destination_url: string;
  label: string | null;
  clicks: number;
  created_at: string;
  updated_at: string;
}

const APP_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "https://allos.org.br";

export default function AtalhosPage() {
  const [links, setLinks] = useState<StudyLink[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const [editTarget, setEditTarget] = useState<StudyLink | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editLabel, setEditLabel] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<StudyLink | null>(null);

  useEffect(() => {
    async function fetchLinks() {
      const client = createClient();
      const { data, error } = await client
        .from("study_links")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar atalhos.");
      } else if (data) {
        setLinks(data as StudyLink[]);
      }
      setLoading(false);
    }
    fetchLinks();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) =>
        l.slug.toLowerCase().includes(q) ||
        (l.label || "").toLowerCase().includes(q) ||
        l.destination_url.toLowerCase().includes(q)
    );
  }, [links, search]);

  function resetCreate() {
    setNewSlug("");
    setNewUrl("");
    setNewLabel("");
  }

  async function handleCreate() {
    const slug = newSlug.trim().toLowerCase();
    const url = newUrl.trim();
    const label = newLabel.trim();

    const slugCheck = validateStudyLinkSlug(slug);
    if (!slugCheck.ok) {
      toast.error(slugCheck.reason);
      return;
    }
    const urlCheck = validateStudyLinkUrl(url);
    if (!urlCheck.ok) {
      toast.error(urlCheck.reason);
      return;
    }
    if (links.some((l) => l.slug === slug)) {
      toast.error("Esse slug já está em uso.");
      return;
    }

    setSaving(true);
    const client = createClient();
    const { data, error } = await client
      .from("study_links")
      .insert({
        slug,
        destination_url: url,
        label: label || null,
      })
      .select("*")
      .single();

    if (error || !data) {
      const msg = error?.message?.includes("duplicate")
        ? "Esse slug já está em uso."
        : "Erro ao criar atalho.";
      toast.error(msg);
      setSaving(false);
      return;
    }

    setLinks((prev) => [data as StudyLink, ...prev]);
    setCreateOpen(false);
    resetCreate();
    setSaving(false);
    toast.success(`Atalho /${slug} criado.`);
  }

  function openEdit(link: StudyLink) {
    setEditTarget(link);
    setEditSlug(link.slug);
    setEditUrl(link.destination_url);
    setEditLabel(link.label || "");
  }

  async function handleEditSave() {
    if (!editTarget) return;
    const slug = editSlug.trim().toLowerCase();
    const url = editUrl.trim();
    const label = editLabel.trim();

    const slugCheck = validateStudyLinkSlug(slug);
    if (!slugCheck.ok) {
      toast.error(slugCheck.reason);
      return;
    }
    const urlCheck = validateStudyLinkUrl(url);
    if (!urlCheck.ok) {
      toast.error(urlCheck.reason);
      return;
    }
    if (slug !== editTarget.slug && links.some((l) => l.slug === slug)) {
      toast.error("Esse slug já está em uso.");
      return;
    }

    setSaving(true);
    const client = createClient();
    const { error } = await client
      .from("study_links")
      .update({
        slug,
        destination_url: url,
        label: label || null,
      })
      .eq("id", editTarget.id);

    if (error) {
      toast.error("Erro ao salvar.");
      setSaving(false);
      return;
    }

    setLinks((prev) =>
      prev.map((l) =>
        l.id === editTarget.id
          ? { ...l, slug, destination_url: url, label: label || null }
          : l
      )
    );
    setEditTarget(null);
    setSaving(false);
    toast.success("Atalho atualizado.");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const client = createClient();
    const { error } = await client
      .from("study_links")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("Erro ao remover.");
      return;
    }

    setLinks((prev) => prev.filter((l) => l.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Atalho removido.");
  }

  async function copyLink(slug: string) {
    const url = `${APP_URL}/formacao/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-fraunces font-bold text-2xl text-cream mb-1">Atalhos</h1>
          <p className="text-sm text-cream/50">
            Links curtos em <code className="text-cream/70">allos.org.br/formacao/&lt;slug&gt;</code> que redirecionam pra URLs externas (WhatsApp, Telegram, Discord etc).
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Novo atalho
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/40" />
        <input
          type="text"
          placeholder="Buscar por slug, rótulo ou URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-white/5 text-cream-90 placeholder:text-cream/45 outline-none border-[1.5px] border-border-soft-2 focus:border-accent/50 focus:ring-[3px] focus:ring-accent/10 transition-all duration-250"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-[14px] p-12 text-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <LinkIcon className="h-10 w-10 mx-auto text-cream/20 mb-3" />
          <p className="text-cream/60 mb-1">
            {search ? "Nenhum atalho corresponde à busca." : "Nenhum atalho criado."}
          </p>
          {!search && (
            <p className="text-xs text-cream/40">
              Clique em <span className="text-cream/70">Novo atalho</span> pra começar.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((link, i) => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="rounded-[12px] p-4 flex items-start gap-4 group"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-cream font-semibold">
                    /{link.slug}
                  </span>
                  {link.label && (
                    <span className="text-xs text-cream/50">— {link.label}</span>
                  )}
                </div>
                <a
                  href={link.destination_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cream/45 hover:text-accent inline-flex items-center gap-1 mt-1 break-all"
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{link.destination_url}</span>
                </a>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="text-right mr-2">
                  <div className="text-sm font-mono text-cream/80">{link.clicks}</div>
                  <div className="text-[10px] text-cream/40 uppercase tracking-wider">
                    {link.clicks === 1 ? "clique" : "cliques"}
                  </div>
                </div>
                <button
                  onClick={() => copyLink(link.slug)}
                  className="p-2 rounded-lg text-cream/50 hover:text-cream hover:bg-white/5 transition-colors"
                  aria-label="Copiar link"
                  title="Copiar link"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => openEdit(link)}
                  className="p-2 rounded-lg text-cream/50 hover:text-cream hover:bg-white/5 transition-colors"
                  aria-label="Editar"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(link)}
                  className="p-2 rounded-lg text-cream/50 hover:text-red-400 hover:bg-red-400/5 transition-colors"
                  aria-label="Remover"
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetCreate();
        }}
        title="Novo atalho"
      >
        <div className="space-y-4">
          <div>
            <Input
              label="Slug (URL)"
              placeholder="ex: jung2026"
              value={newSlug}
              onChange={(e) =>
                setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
            />
            {newSlug && (
              <p className="text-xs text-cream/45 mt-1.5">
                Preview: <span className="font-mono text-cream/70">{APP_URL.replace(/^https?:\/\//, "")}/formacao/{newSlug}</span>
              </p>
            )}
          </div>
          <Input
            label="URL de destino"
            placeholder="https://chat.whatsapp.com/..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <Input
            label="Rótulo do botão (opcional)"
            placeholder="Entrar no grupo de estudo"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setCreateOpen(false);
                resetCreate();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Criando..." : "Criar atalho"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Editar atalho"
      >
        <div className="space-y-4">
          <div>
            <Input
              label="Slug (URL)"
              value={editSlug}
              onChange={(e) =>
                setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
            />
            {editSlug && (
              <p className="text-xs text-cream/45 mt-1.5">
                Preview: <span className="font-mono text-cream/70">{APP_URL.replace(/^https?:\/\//, "")}/formacao/{editSlug}</span>
              </p>
            )}
          </div>
          <Input
            label="URL de destino"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
          />
          <Input
            label="Rótulo do botão (opcional)"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
          />
          {editTarget && (
            <p className="text-xs text-cream/40">
              {editTarget.clicks} {editTarget.clicks === 1 ? "clique" : "cliques"} acumulado{editTarget.clicks === 1 ? "" : "s"}.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remover atalho"
      >
        <div className="space-y-4">
          <p className="text-sm text-cream/70">
            Remover o atalho <span className="font-mono text-cream">/{deleteTarget?.slug}</span>?
            O link <span className="font-mono text-cream/60">{APP_URL.replace(/^https?:\/\//, "")}/formacao/{deleteTarget?.slug}</span> deixará de funcionar.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Remover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
