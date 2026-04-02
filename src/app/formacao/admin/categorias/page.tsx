"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { motion } from "framer-motion";
import { Plus, X, Tag, RotateCcw, AlertTriangle, BookOpen, Pencil, Check, ArrowUp, ArrowDown, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface CategoryRow {
  id: string;
  name: string;
  position: number;
}

interface CourseRow {
  id: string;
  title: string;
  display_order: number;
}

export default function CategoriasPage() {
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [usedCategories, setUsedCategories] = useState<Record<string, number>>({});
  const [coursesByCategory, setCoursesByCategory] = useState<Record<string, CourseRow[]>>({});
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      const client = createClient();

      const [catsRes, coursesRes] = await Promise.all([
        client.from("categories").select("id, name, position").order("position"),
        client.from("courses").select("id, title, category, display_order").not("category", "is", null).order("display_order").order("created_at", { ascending: false }),
      ]);

      const counts: Record<string, number> = {};
      const byCategory: Record<string, CourseRow[]> = {};
      coursesRes.data?.forEach((c: { id: string; title: string; category: string; display_order: number }) => {
        if (c.category) {
          counts[c.category] = (counts[c.category] || 0) + 1;
          if (!byCategory[c.category]) byCategory[c.category] = [];
          byCategory[c.category].push({ id: c.id, title: c.title, display_order: c.display_order ?? 0 });
        }
      });
      setUsedCategories(counts);
      setCoursesByCategory(byCategory);

      if (catsRes.data) {
        setCategories(catsRes.data.map((c, i) => ({ ...c, position: c.position ?? i })));
      }
      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, []);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    if (categories.some((c) => c.name === name)) {
      toast.error("Essa categoria já existe.");
      return;
    }

    setAdding(true);
    const client = createClient();
    const position = categories.length;
    const { data, error } = await client
      .from("categories")
      .insert({ name, position })
      .select("id, name, position")
      .single();

    if (error || !data) {
      toast.error("Erro ao adicionar categoria.");
      setAdding(false);
      return;
    }

    setCategories((prev) => [...prev, { ...data, position: data.position ?? position }]);
    setNewName("");
    setAdding(false);
    toast.success(`Categoria "${name}" adicionada!`);
  }

  async function handleRemove() {
    if (!deleteTarget) return;
    const client = createClient();

    const courses = coursesByCategory[deleteTarget.name] || [];
    if (courses.length > 0) {
      await client.from("courses").update({ category: null }).eq("category", deleteTarget.name);
    }

    const { error } = await client.from("categories").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Erro ao remover categoria.");
      return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setUsedCategories((prev) => { const next = { ...prev }; delete next[deleteTarget.name]; return next; });
    setCoursesByCategory((prev) => { const next = { ...prev }; delete next[deleteTarget.name]; return next; });
    setDeleteTarget(null);
    toast.success(`Categoria removida.${courses.length > 0 ? ` ${courses.length} curso(s) desassociado(s).` : ""}`);
  }

  async function handleEdit(cat: CategoryRow) {
    const name = editName.trim();
    if (!name || name === cat.name) { setEditingId(null); return; }
    if (categories.some((c) => c.name === name && c.id !== cat.id)) {
      toast.error("Essa categoria já existe.");
      return;
    }
    const client = createClient();
    const { error } = await client.from("categories").update({ name }).eq("id", cat.id);
    if (error) { toast.error("Erro ao renomear."); return; }
    await client.from("courses").update({ category: name }).eq("category", cat.name);
    // Update local state — keep position order
    setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, name } : c));
    // Update coursesByCategory key
    setCoursesByCategory((prev) => {
      const next = { ...prev };
      if (next[cat.name]) {
        next[name] = next[cat.name];
        delete next[cat.name];
      }
      return next;
    });
    setUsedCategories((prev) => {
      const next = { ...prev };
      if (next[cat.name] !== undefined) {
        next[name] = next[cat.name];
        delete next[cat.name];
      }
      return next;
    });
    setEditingId(null);
    toast.success(`Categoria renomeada para "${name}"`);
  }

  async function handleMoveCategory(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newCats = [...categories];
    const [moved] = newCats.splice(index, 1);
    newCats.splice(targetIndex, 0, moved);

    // Update positions
    const updated = newCats.map((c, i) => ({ ...c, position: i }));
    setCategories(updated);

    // Persist both swapped positions
    const client = createClient();
    await Promise.all([
      client.from("categories").update({ position: updated[index].position }).eq("id", updated[index].id),
      client.from("categories").update({ position: updated[targetIndex].position }).eq("id", updated[targetIndex].id),
    ]);
  }

  async function handleMoveCourse(categoryName: string, courseIndex: number, direction: "up" | "down") {
    const courses = [...(coursesByCategory[categoryName] || [])];
    const targetIndex = direction === "up" ? courseIndex - 1 : courseIndex + 1;
    if (targetIndex < 0 || targetIndex >= courses.length) return;

    const [moved] = courses.splice(courseIndex, 1);
    courses.splice(targetIndex, 0, moved);

    // Update display_order
    const updated = courses.map((c, i) => ({ ...c, display_order: i }));
    setCoursesByCategory((prev) => ({ ...prev, [categoryName]: updated }));

    // Persist
    const client = createClient();
    await Promise.all([
      client.from("courses").update({ display_order: updated[courseIndex].display_order }).eq("id", updated[courseIndex].id),
      client.from("courses").update({ display_order: updated[targetIndex].display_order }).eq("id", updated[targetIndex].id),
    ]);
  }

  async function handleReset() {
    const client = createClient();

    const nonDefaults = categories.filter(
      (c) => !DEFAULT_CATEGORIES.includes(c.name) && !usedCategories[c.name]
    );
    for (const cat of nonDefaults) {
      await client.from("categories").delete().eq("id", cat.id);
    }

    for (const name of DEFAULT_CATEGORIES) {
      if (!categories.some((c) => c.name === name)) {
        await client.from("categories").insert({ name });
      }
    }

    const { data } = await client.from("categories").select("id, name, position").order("position");
    if (data) setCategories(data.map((c, i) => ({ ...c, position: c.position ?? i })));
    toast.success("Categorias restauradas ao padrão.");
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <Tag className="h-12 w-12 text-cream/20 mx-auto mb-4" />
        <h2 className="font-fraunces font-bold text-xl text-cream mb-2">Acesso restrito</h2>
        <p className="text-cream/40">Apenas administradores podem gerenciar categorias.</p>
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
            Categorias
          </h1>
          <p className="text-sm text-cream/35 mt-1">
            Gerencie as categorias e a ordem de exibição dos cursos.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          Restaurar padrão
        </Button>
      </motion.div>

      {/* Add new category */}
      <div
        className="flex flex-col sm:flex-row gap-3 mb-8 p-5 rounded-[16px]"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="relative flex-1">
          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
          <input
            type="text"
            placeholder="Nome da nova categoria..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm"
          />
        </div>
        <Button onClick={handleAdd} disabled={!newName.trim() || adding} loading={adding}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Categories list — ordered */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-[12px] animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat, i) => {
            const count = usedCategories[cat.name] || 0;
            const isDefault = DEFAULT_CATEGORIES.includes(cat.name);
            const isExpanded = expandedCat === cat.id;
            const courses = coursesByCategory[cat.name] || [];

            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-[12px] overflow-hidden transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-center justify-between p-4 group">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Move buttons */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveCategory(i, "up")}
                        disabled={i === 0}
                        className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveCategory(i, "down")}
                        disabled={i === categories.length - 1}
                        className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>

                    <span className="text-[10px] font-bold text-cream/15 w-5 text-center flex-shrink-0">{i + 1}</span>

                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isDefault ? "rgba(200,75,49,0.08)" : "rgba(46,158,143,0.08)",
                        border: isDefault ? "1px solid rgba(200,75,49,0.15)" : "1px solid rgba(46,158,143,0.15)",
                      }}
                    >
                      <Tag className="h-3.5 w-3.5" style={{ color: isDefault ? "#C84B31" : "#2E9E8F" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {editingId === cat.id ? (
                        <div className="flex items-center gap-1.5">
                          <input type="text" value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleEdit(cat); if (e.key === "Escape") setEditingId(null); }}
                            autoFocus
                            className="flex-1 px-2 py-1 rounded text-sm font-dm outline-none min-w-0"
                            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FDFBF7" }} />
                          <button onClick={() => handleEdit(cat)} className="p-1 rounded hover:bg-white/[0.06]" style={{ color: "#22c55e" }}><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-white/[0.06]" style={{ color: "rgba(253,251,247,0.3)" }}><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-cream truncate">{cat.name}</p>
                          <p className="text-[11px] text-cream/25">
                            {count > 0 ? `${count} curso${count !== 1 ? "s" : ""}` : "Sem cursos"}
                            {isDefault && " · Padrão"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {courses.length > 0 && (
                      <button
                        onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                        className="p-1.5 rounded-lg text-cream/20 hover:text-cream/50 hover:bg-white/[0.04] transition-all"
                        title="Ver cursos"
                      >
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                      className="p-1.5 rounded-lg text-cream/15 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                      aria-label={`Editar ${cat.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(cat)}
                      className="p-1.5 rounded-lg text-cream/15 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      aria-label={`Remover ${cat.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded courses list for reordering */}
                {isExpanded && courses.length > 0 && (
                  <div
                    className="px-4 pb-4 space-y-1"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <p className="text-[10px] text-cream/25 uppercase tracking-wider font-semibold pt-3 pb-1 px-1">
                      Ordem dos cursos
                    </p>
                    {courses.map((course, ci) => (
                      <div
                        key={course.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveCourse(cat.name, ci, "up")}
                            disabled={ci === 0}
                            className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowUp className="h-2.5 w-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveCourse(cat.name, ci, "down")}
                            disabled={ci === courses.length - 1}
                            className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowDown className="h-2.5 w-2.5" />
                          </button>
                        </div>
                        <span className="text-[10px] font-bold text-cream/15 w-4 text-center flex-shrink-0">{ci + 1}</span>
                        <BookOpen className="h-3 w-3 text-cream/20 flex-shrink-0" />
                        <span className="text-xs text-cream/60 truncate flex-1">{course.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {categories.length === 0 && !loading && (
        <div className="text-center py-16">
          <BookOpen className="h-10 w-10 text-cream/15 mx-auto mb-3" />
          <p className="text-cream/35 text-sm">Nenhuma categoria configurada.</p>
        </div>
      )}

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remover categoria"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-cream/50">
              Tem certeza que deseja remover a categoria <span className="font-medium text-cream">&quot;{deleteTarget.name}&quot;</span>?
            </p>
            {DEFAULT_CATEGORIES.includes(deleteTarget.name) && (
              <div
                className="flex items-center gap-3 p-3 rounded-[10px]"
                style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}
              >
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">
                  Esta é uma categoria padrão. Você pode restaurá-la depois.
                </p>
              </div>
            )}
            {(coursesByCategory[deleteTarget.name] || []).length > 0 && (
              <div className="rounded-[10px] p-3 space-y-2" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <p className="text-xs text-red-300 font-medium">
                  {coursesByCategory[deleteTarget.name].length} curso(s) usam esta categoria e serão desassociados:
                </p>
                <div className="space-y-1">
                  {coursesByCategory[deleteTarget.name].map((c) => (
                    <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <BookOpen className="h-3 w-3 text-cream/30 flex-shrink-0" />
                      <span className="text-xs text-cream/70 truncate">{c.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" onClick={handleRemove}>
                Remover{(coursesByCategory[deleteTarget.name] || []).length > 0 ? " e desassociar" : ""}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
