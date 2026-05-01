"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Search, Shield, AlertTriangle, Plus, UserPlus, BookOpen, Check } from "lucide-react";
import type { Profile, UserRole } from "@/types";

const CategoriasPage = dynamic(() => import("@/app/formacao/admin/categorias/page"), { ssr: false });

const ROLES_PER_PAGE = 20;

const roleLabels: Record<string, string> = {
  admin: "Admin",
  instructor: "Professor",
  associado: "Associado",
  student: "Aluno",
};

// ─── Professors Tab ───
function ProfessoresTab() {
  const [instructors, setInstructors] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string; instructor_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetch() {
      const client = createClient();
      const [insRes, coursesRes] = await Promise.all([
        client.from("profiles").select("*").in("role", ["instructor", "admin"]).order("full_name"),
        client.from("courses").select("id, title, instructor_id").order("title"),
      ]);
      if (insRes.data) setInstructors(insRes.data);
      if (coursesRes.data) setCourses(coursesRes.data);
      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, []);

  async function handleCreate() {
    const name = createName.trim();
    const email = createEmail.trim();
    if (!name) { toast.error("Nome é obrigatório."); return; }

    setCreating(true);
    const client = createClient();

    // Create profile directly (no auth user needed)
    const id = crypto.randomUUID();
    const { data, error } = await client.from("profiles").insert({
      id,
      full_name: name,
      email: email || `${name.toLowerCase().replace(/\s+/g, ".")}@professor.allos`,
      role: "instructor",
    }).select("*").single();

    if (error) {
      toast.error("Erro ao criar professor: " + error.message);
      setCreating(false);
      return;
    }

    setInstructors((prev) => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setCreateName("");
    setCreateEmail("");
    setShowCreate(false);
    setCreating(false);
    toast.success(`Professor "${name}" criado!`);
  }

  function openAssign(instructor: Profile) {
    const assigned = new Set(
      courses.filter((c) => c.instructor_id === instructor.id).map((c) => c.id)
    );
    setSelectedCourses(assigned);
    setAssigningId(instructor.id);
  }

  async function handleAssign() {
    if (!assigningId) return;
    const client = createClient();

    // Find courses that changed
    const currentCourses = courses.filter((c) => c.instructor_id === assigningId).map((c) => c.id);
    const currentSet = new Set(currentCourses);

    const toAssign = Array.from(selectedCourses).filter((id) => !currentSet.has(id));

    // Assign new courses to this instructor
    for (const courseId of toAssign) {
      await client.from("courses").update({ instructor_id: assigningId }).eq("id", courseId);
    }

    // Unassigned courses need a fallback instructor — skip unassign for now
    // (can't set instructor_id to null, it's NOT NULL)

    // Update local state
    setCourses((prev) =>
      prev.map((c) => {
        if (toAssign.includes(c.id)) return { ...c, instructor_id: assigningId };
        return c;
      })
    );

    setAssigningId(null);
    toast.success(`Cursos atualizados!`);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  const assigningInstructor = instructors.find((i) => i.id === assigningId);

  return (
    <div>
      {/* Create button */}
      <div className="mb-6">
        {!showCreate ? (
          <Button onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4" />
            Criar professor
          </Button>
        ) : (
          <div
            className="p-5 rounded-[16px] space-y-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="font-dm text-sm font-semibold text-cream/70">Novo professor</p>
            <p className="text-xs text-cream/30">Cria um perfil de professor sem precisar de cadastro. Útil para professores externos.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Nome completo *"
                className="px-4 py-2.5 rounded-[10px] dark-input text-sm"
              />
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="Email (opcional)"
                className="px-4 py-2.5 rounded-[10px] dark-input text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} loading={creating} disabled={!createName.trim()}>
                <Plus className="h-4 w-4" />
                Criar
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>

      {/* Instructors list */}
      <div className="space-y-2">
        {instructors.map((inst) => {
          const assignedCourses = courses.filter((c) => c.instructor_id === inst.id);
          return (
            <div
              key={inst.id}
              className="flex items-center gap-4 p-4 rounded-[12px] group"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(200,75,49,0.1)", border: "1px solid rgba(200,75,49,0.2)" }}
              >
                {inst.avatar_url ? (
                  <Image
                    src={inst.avatar_url}
                    alt=""
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="font-fraunces font-bold text-sm text-accent">
                    {inst.full_name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-dm text-sm font-medium text-cream truncate">{inst.full_name}</p>
                <p className="font-dm text-[11px] text-cream/25 truncate">{inst.email}</p>
                {assignedCourses.length > 0 && (
                  <p className="font-dm text-[11px] text-cream/35 mt-0.5">
                    {assignedCourses.length} curso{assignedCourses.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <Badge variant={inst.role}>{roleLabels[inst.role]}</Badge>
              <button
                onClick={() => openAssign(inst)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{ background: "rgba(46,158,143,0.1)", border: "1px solid rgba(46,158,143,0.2)", color: "#2E9E8F" }}
              >
                <BookOpen className="h-3 w-3 inline mr-1" />
                Cursos
              </button>
            </div>
          );
        })}
      </div>

      {instructors.length === 0 && (
        <div className="text-center py-16">
          <UserPlus className="h-10 w-10 text-cream/15 mx-auto mb-3" />
          <p className="text-cream/35 text-sm">Nenhum professor cadastrado.</p>
        </div>
      )}

      {/* Assign courses modal */}
      <Modal
        open={!!assigningId}
        onClose={() => setAssigningId(null)}
        title="Vincular cursos"
      >
        {assigningInstructor && (
          <div className="space-y-4">
            <p className="text-sm text-cream/40">
              Selecione os cursos de{" "}
              <span className="font-medium text-cream">{assigningInstructor.full_name}</span>
            </p>

            <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1">
              {courses.map((course) => {
                const isSelected = selectedCourses.has(course.id);
                const currentInstructor = course.instructor_id !== assigningId
                  ? instructors.find((i) => i.id === course.instructor_id)
                  : null;

                return (
                  <button
                    key={course.id}
                    onClick={() => {
                      setSelectedCourses((prev) => {
                        const next = new Set(prev);
                        if (next.has(course.id)) next.delete(course.id);
                        else next.add(course.id);
                        return next;
                      });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: isSelected ? "rgba(46,158,143,0.08)" : "rgba(255,255,255,0.02)",
                      border: isSelected ? "1px solid rgba(46,158,143,0.2)" : "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isSelected ? "#2E9E8F" : "rgba(255,255,255,0.06)",
                        border: isSelected ? "none" : "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-dm text-sm text-cream truncate">{course.title}</p>
                      {currentInstructor && (
                        <p className="font-dm text-[10px] text-cream/25">
                          Atual: {currentInstructor.full_name}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-cream/30">
                {selectedCourses.size} curso{selectedCourses.size !== 1 ? "s" : ""} selecionado{selectedCourses.size !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setAssigningId(null)}>Cancelar</Button>
                <Button onClick={handleAssign}>Salvar</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function AdminConfiguracoesPage() {
  const { profile, isAdmin } = useAuth();
  const [configTab, setConfigTab] = useState<"usuarios" | "professores" | "categorias">("usuarios");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>("student");
  const [visibleCount, setVisibleCount] = useState(ROLES_PER_PAGE);

  useEffect(() => {
    async function fetch() {
      if (!isAdmin) {
        setLoading(false);
        return;
      }

      const { data } = await createClient()
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setUsers(data);
      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, [isAdmin]);

  async function updateRole() {
    if (!editingUser || !profile) return;

    // Prevent self-demotion
    if (editingUser.id === profile.id && newRole !== "admin") {
      toast.error("Você não pode remover sua própria permissão de admin.");
      return;
    }

    const res = await window.fetch("/formacao/admin/configuracoes/update-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId: editingUser.id, role: newRole }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erro ao atualizar permissão.");
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === editingUser.id ? { ...u, role: newRole } : u
      )
    );
    setEditingUser(null);
    toast.success("Permissão atualizada!");
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="h-12 w-12 text-cream/20 mx-auto mb-4" />
        <h2 className="font-fraunces font-bold text-xl text-cream mb-2">
          Acesso restrito
        </h2>
        <p className="text-cream/40">
          Apenas administradores podem acessar as configurações.
        </p>
      </div>
    );
  }

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

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
          Configurações
        </h1>
        <p className="text-cream/40 text-sm mt-1">
          Gerencie usuários, professores e categorias.
        </p>
        <div className="flex gap-2 mt-4 flex-wrap">
          {(["usuarios", "professores", "categorias"] as const).map(t => (
            <button key={t} onClick={() => setConfigTab(t)}
              className="font-dm text-xs px-4 py-2 rounded-full transition-all"
              style={{
                backgroundColor: configTab === t ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
                color: configTab === t ? "#C84B31" : "rgba(253,251,247,0.4)",
                border: `1px solid ${configTab === t ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}>
              {t === "usuarios" ? "Usuários" : t === "professores" ? "Professores" : "Categorias"}
            </button>
          ))}
        </div>
      </motion.div>

      {configTab === "categorias" && <CategoriasPage />}

      {configTab === "professores" && <ProfessoresTab />}

      {configTab === "usuarios" && (<>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm"
            aria-label="Buscar usuários"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "student", "associado", "instructor", "admin"].map((r) => (
            <button
              key={r}
              onClick={() => { setRoleFilter(r); setVisibleCount(ROLES_PER_PAGE); }}
              className="px-3 py-2 rounded-[10px] text-xs font-semibold transition-all duration-200"
              style={{
                background: roleFilter === r ? "linear-gradient(135deg, #C84B31, #A33D27)" : "rgba(255,255,255,0.04)",
                color: roleFilter === r ? "#fff" : "rgba(253,251,247,0.45)",
                border: `1px solid ${roleFilter === r ? "#C84B31" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {r === "all" ? `Todos (${users.length})` : `${roleLabels[r]} (${users.filter((u) => u.role === r).length})`}
            </button>
          ))}
        </div>
      </div>

      <div
        className="rounded-[16px] overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <th className="text-left px-4 py-3 font-semibold text-cream/50">Nome</th>
                <th className="text-left px-4 py-3 font-semibold text-cream/50 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-cream/50">Permissão</th>
                <th className="text-right px-4 py-3 font-semibold text-cream/50">Ação</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <td className="px-4 py-3 font-medium text-cream">
                    <div className="flex items-center gap-2">
                      {user.full_name}
                      {user.id === profile?.id && (
                        <span className="text-[10px] text-cream/25 font-dm">(você)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-cream/40 hidden md:table-cell">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={user.role}>{roleLabels[user.role]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setNewRole(user.role);
                      }}
                      className="text-xs text-accent hover:text-accent-light transition-colors"
                    >
                      Alterar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="p-4 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <button
              onClick={() => setVisibleCount((prev) => prev + ROLES_PER_PAGE)}
              className="text-sm text-cream/40 hover:text-cream/60 transition-colors"
            >
              Mostrar mais ({filtered.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </div>

      {/* Edit role modal with confirmation */}
      <Modal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Alterar permissão"
      >
        {editingUser && (
          <div className="space-y-4">
            <p className="text-sm text-cream/40">
              Alterar permissão de{" "}
              <span className="font-medium text-cream">{editingUser.full_name}</span>
            </p>

            {/* Self-demotion warning */}
            {editingUser.id === profile?.id && (
              <div
                className="flex items-center gap-3 p-3 rounded-[10px]"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
              >
                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300">
                  Este é o seu próprio perfil. Não é possível remover sua permissão de admin.
                </p>
              </div>
            )}

            <Select
              label="Nova permissão"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              options={[
                { value: "student", label: "Aluno" },
                { value: "associado", label: "Associado" },
                { value: "instructor", label: "Professor" },
                { value: "admin", label: "Administrador" },
              ]}
            />

            {/* Danger confirmation for admin role */}
            {newRole === "admin" && editingUser.role !== "admin" && (
              <div
                className="flex items-center gap-3 p-3 rounded-[10px]"
                style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}
              >
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">
                  Administradores têm acesso total à plataforma.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setEditingUser(null)}>
                Cancelar
              </Button>
              <Button
                onClick={updateRole}
                disabled={editingUser.id === profile?.id && newRole !== "admin"}
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </Modal>
      </>)}
    </div>
  );
}
