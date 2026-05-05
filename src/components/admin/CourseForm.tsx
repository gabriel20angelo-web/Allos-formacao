// Wizard de criar/editar curso. Usado em /admin/cursos/novo (sem courseId)
// e /admin/cursos/[id]/editar (com courseId). 2000+ linhas porque cada step
// tem seu próprio setor de UI:
//   - "info":        título, slug, categoria, capa, tipo (sync/async)
//   - "content":     seções e aulas (com dnd-kit)
//   - "meetings":    encontros ao vivo (só pra course_type === "sync")
//   - "exam":        prova final + perguntas + opções
//   - "certificate": carga horária + texto + preview (já em CertificateStep)
//
// Estado central + autosave debounced + dirty tracking + saveCourseRef pra
// evitar saves concorrentes. Carregado dynamic em /novo e /[id]/editar pra
// não inflar o JS inicial. Steps individuais devem virar componentes
// próprios em src/components/admin/course-form/ — feito o CertificateStep,
// faltam os outros.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import ImageUpload from "@/components/ui/ImageUpload";
import CertificateStep from "@/components/admin/course-form/CertificateStep";
import { useCategories } from "@/hooks/useCategories";
import { slugify } from "@/lib/utils/format";
import { detectVideoSource } from "@/lib/utils/video";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  X,
  Sparkles,
  Clock,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Section, Lesson, ExamQuestion, ExamOption } from "@/types";

interface CourseFormProps {
  courseId?: string;
}

type Step = "info" | "content" | "meetings" | "exam" | "certificate";

const ALL_STEPS: { id: Step; label: string }[] = [
  { id: "info", label: "Informações" },
  { id: "content", label: "Conteúdo" },
  { id: "exam", label: "Prova" },
  { id: "certificate", label: "Certificado" },
];

const SYNC_STEPS: { id: Step; label: string }[] = [
  { id: "info", label: "Informações" },
  { id: "content", label: "Conteúdo" },
  { id: "meetings", label: "Encontros & Comunidade" },
];

const COLLECTION_STEPS: { id: Step; label: string }[] = [
  { id: "info", label: "Informações" },
  { id: "content", label: "Conteúdo" },
];

// Helper: extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Helper: check if URL is Vimeo
function isVimeoUrl(url: string): boolean {
  return /vimeo\.com/.test(url);
}

// Category picker with create-new inline
function CategoryPicker({ categories, value, onChange }: { categories: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    const name = newCat.trim();
    if (!name) return;
    setCreating(true);
    const { error } = await createClient().from("categories").insert({ name });
    setCreating(false);
    if (error) { toast.error("Erro ao criar categoria"); return; }
    onChange(name);
    setNewCat("");
    setOpen(false);
    toast.success(`Categoria "${name}" criada`);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-cream/70">Categoria</label>
      <div className="relative">
        <button type="button" onClick={() => setOpen(!open)}
          className="w-full px-4 py-2.5 rounded-[10px] dark-input text-sm font-dm text-left flex items-center justify-between">
          <span style={{ color: value ? "#FDFBF7" : "rgba(253,251,247,0.3)" }}>{value || "Selecione uma categoria"}</span>
          <svg className="h-4 w-4 text-cream/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg py-1 max-h-60 overflow-auto"
              style={{ backgroundColor: "#1E1E1E", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
              {value && (
                <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-dm hover:bg-white/[0.04]" style={{ color: "rgba(253,251,247,0.3)" }}>
                  Limpar seleção
                </button>
              )}
              {categories.map(c => (
                <button type="button" key={c} onClick={() => { onChange(c); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm font-dm hover:bg-white/[0.04]"
                  style={{ color: c === value ? "#C84B31" : "rgba(253,251,247,0.7)" }}>
                  {c}
                </button>
              ))}
              <div className="border-t border-white/[0.06] mt-1 pt-1 px-2 pb-1">
                <div className="flex gap-1.5">
                  <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleCreate())}
                    placeholder="Nova categoria..."
                    className="flex-1 px-2.5 py-1.5 rounded text-xs font-dm outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#FDFBF7" }} />
                  <button type="button" onClick={handleCreate} disabled={creating || !newCat.trim()}
                    className="px-2.5 py-1.5 rounded text-xs font-dm font-bold disabled:opacity-30"
                    style={{ backgroundColor: "#C84B31", color: "#fff" }}>
                    {creating ? "..." : "+"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SortableItem({ id, children }: { id: string; children: (props: { dragHandleProps: Record<string, unknown> }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : "auto" as const,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ dragHandleProps: listeners as Record<string, unknown> })}
    </div>
  );
}

export default function CourseForm({ courseId }: CourseFormProps) {
  const router = useRouter();
  const { profile, isAdmin } = useAuth();
  const { categories: availableCategories } = useCategories();
  const isEdit = !!courseId;

  const [step, setStep] = useState<Step>("info");
  const [saving, setSaving] = useState(false);

  // Basic info
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [category, setCategory] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [priceCents, setPriceCents] = useState(0);
  const [instructorId, setInstructorId] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [courseType, setCourseType] = useState<"async" | "sync" | "collection">("async");
  const [certLessonsRequired, setCertLessonsRequired] = useState<number | null>(null);
  const [certHoursValue, setCertHoursValue] = useState<number | null>(null);
  const [isDiscontinued, setIsDiscontinued] = useState(false);
  const [showInstructor, setShowInstructor] = useState(false);
  const [defaultLessonThumbnail, setDefaultLessonThumbnail] = useState("");
  const STEPS = courseType === "collection" ? COLLECTION_STEPS : courseType === "sync" ? SYNC_STEPS : ALL_STEPS;
  const [learningPoints, setLearningPoints] = useState<string[]>([""]);

  // Sync course: comunidade + encontros
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState("");
  const [meetUrl, setMeetUrl] = useState("");
  const [instructorBio, setInstructorBio] = useState("");
  const [liveSessionDuration, setLiveSessionDuration] = useState(120);
  type MeetingDraft = {
    id: string;
    starts_at: string;
    title: string;
    meet_url_override: string;
    _new?: boolean;
  };
  const [meetings, setMeetings] = useState<MeetingDraft[]>([]);
  const [deletedMeetingIds, setDeletedMeetingIds] = useState<string[]>([]);

  // Content
  const [sections, setSections] = useState<
    (Section & { lessons: (Lesson & { _new?: boolean })[] })[]
  >([]);

  // Exam
  const [examEnabled, setExamEnabled] = useState(false);
  const [examPassingScore, setExamPassingScore] = useState(70);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);

  // Certificate
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [certificateHours, setCertificateHours] = useState<number | null>(null);
  const [certificateBodyText, setCertificateBodyText] = useState("");

  // Instructors list (for admin)
  const [instructors, setInstructors] = useState<
    { value: string; label: string }[]
  >([]);

  // Default duration input
  const [defaultDuration, setDefaultDuration] = useState(90);

  // --- NEW STATE: delete confirmation ---
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // --- Track deleted sections/lessons for DB cleanup ---
  const [, setDeletedSectionIds] = useState<string[]>([]);
  const [, setDeletedLessonIds] = useState<string[]>([]);

  // --- NEW STATE: unsaved changes tracking ---
  const [isDirty, setIsDirty] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // --- Autosave state ---
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const saveCourseRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>();
  // Guard to prevent concurrent saves
  const isSavingRef = useRef(false);

  // --- NEW: beforeunload warning ---
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // --- NEW: mark dirty helper ---
  const markDirty = useCallback(() => {
    if (initialLoadDone) setIsDirty(true);
  }, [initialLoadDone]);

  // Autosave disabled — manual save only to prevent data corruption

  // Load data
  useEffect(() => {
    async function load() {
      // Load instructors list
      if (isAdmin) {
        const { data } = await createClient()
          .from("profiles")
          .select("id, full_name")
          .in("role", ["instructor", "admin"]);
        if (data) {
          setInstructors(
            data.map((p) => ({ value: p.id, label: p.full_name }))
          );
        }
      }

      if (profile) {
        setInstructorId(profile.id);
      }

      if (!courseId) {
        setInitialLoadDone(true);
        return;
      }

      // Load course
      const { data: course } = await createClient()
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

      if (!course) {
        router.push("/formacao/admin/cursos");
        return;
      }

      setTitle(course.title);
      setSlug(course.slug);
      setDescription(course.description || "");
      setLongDescription(course.long_description || "");
      setCategory(course.category || "");
      setThumbnailUrl(course.thumbnail_url || "");
      setIsFree(course.is_free);
      setPriceCents(course.price_cents || 0);
      setInstructorId(course.instructor_id);
      setStatus(course.status);
      setExamEnabled(course.exam_enabled);
      setExamPassingScore(course.exam_passing_score);
      setCertificateEnabled(course.certificate_enabled);
      setCertificateHours(course.certificate_hours ?? null);
      setCertificateBodyText(course.certificate_body_text || "");
      setWhatsappNumber(course.whatsapp_number || "");
      setCourseType(course.course_type || "async");
      setCertLessonsRequired(course.cert_lessons_required ?? null);
      setCertHoursValue(course.cert_hours_value ?? null);
      setIsDiscontinued(course.is_discontinued ?? false);
      setShowInstructor(course.show_instructor ?? false);
      setDefaultLessonThumbnail(course.default_lesson_thumbnail_url || "");
      setLearningPoints(course.learning_points || [""]);
      setWhatsappGroupUrl(course.whatsapp_group_url || "");
      setMeetUrl(course.meet_url || "");
      setInstructorBio(course.instructor_bio || "");
      setLiveSessionDuration(course.live_session_duration_minutes ?? 120);

      // Load meetings agendados pra cursos sync
      const { data: meetingsData } = await createClient()
        .from("course_meetings")
        .select("id, starts_at, title, meet_url_override")
        .eq("course_id", courseId)
        .order("starts_at", { ascending: true });

      if (meetingsData) {
        setMeetings(
          meetingsData.map((m: { id: string; starts_at: string; title: string | null; meet_url_override: string | null }) => ({
            id: m.id,
            starts_at: m.starts_at,
            title: m.title || "",
            meet_url_override: m.meet_url_override || "",
          })),
        );
      }

      // Load sections + lessons
      const { data: sectionsData } = await createClient()
        .from("sections")
        .select("*, lessons(*, attachments:lesson_attachments(*))")
        .eq("course_id", courseId)
        .order("position")
        .order("position", { referencedTable: "lessons" });

      if (sectionsData) {
        setSections(sectionsData as typeof sections);
      }

      // Load exam questions
      const { data: questionsData } = await createClient()
        .from("exam_questions")
        .select("*")
        .eq("course_id", courseId)
        .order("position");

      if (questionsData) setQuestions(questionsData);

      setInitialLoadDone(true);
    }

    load();
  }, [courseId, profile, isAdmin, router]);

  // Auto-generate slug
  useEffect(() => {
    if (!isEdit) {
      setSlug(slugify(title));
    }
  }, [title, isEdit]);

  async function saveCourse(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    // Prevent concurrent saves — skip if already saving
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    // Cancel pending autosave when saving manually
    if (!silent && autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }

    if (!title.trim() || !slug.trim()) {
      if (!silent) toast.error("Título e slug são obrigatórios.");
      isSavingRef.current = false;
      return;
    }

    if (silent) {
      setIsAutoSaving(true);
    } else {
      setSaving(true);
    }

    try {
      const courseData = {
        title,
        slug,
        description: description || null,
        long_description: longDescription || null,
        category: category || null,
        thumbnail_url: thumbnailUrl || null,
        is_free: isFree,
        price_cents: isFree ? null : priceCents,
        instructor_id: instructorId,
        status,
        exam_enabled: examEnabled,
        exam_passing_score: examPassingScore,
        certificate_enabled: certificateEnabled,
        certificate_hours: certificateHours,
        certificate_body_text: certificateBodyText || null,
        whatsapp_number: whatsappNumber || null,
        course_type: courseType,
        is_discontinued: isDiscontinued,
        show_instructor: showInstructor,
        cert_lessons_required: courseType === "collection" ? (certLessonsRequired || null) : null,
        cert_hours_value: courseType === "collection" ? (certHoursValue || null) : null,
        default_lesson_thumbnail_url: defaultLessonThumbnail || null,
        learning_points: learningPoints.filter((p) => p.trim()),
        whatsapp_group_url: courseType === "sync" ? (whatsappGroupUrl.trim() || null) : null,
        meet_url: courseType === "sync" ? (meetUrl.trim() || null) : null,
        instructor_bio: courseType === "sync" ? (instructorBio.trim() || null) : null,
        live_session_duration_minutes: courseType === "sync" ? (liveSessionDuration || 120) : null,
      };

      let savedCourseId = courseId;

      if (isEdit) {
        const { error } = await createClient()
          .from("courses")
          .update(courseData)
          .eq("id", courseId);

        if (error) {
          if (!silent) toast.error("Erro ao atualizar curso.");
          return;
        }
      } else {
        const { data, error } = await createClient()
          .from("courses")
          .insert(courseData)
          .select("id")
          .single();

        if (error || !data) {
          if (!silent) toast.error("Erro ao criar curso.");
          return;
        }
        savedCourseId = data.id;
      }

      // Save sections and lessons
      if (savedCourseId) {
        // Collect IDs of sections/lessons that should exist after save
        const localSectionIds = new Set<string>();
        const localLessonIds = new Set<string>();

        // Map old new-xxx IDs → real DB IDs (for functional setState at the end)
        const idMap = new Map<string, string>();

        for (let si = 0; si < sections.length; si++) {
          const section = sections[si];
          let sectionId = section.id;

          if (section.id.startsWith("new-")) {
            const { data, error } = await createClient()
              .from("sections")
              .insert({
                course_id: savedCourseId,
                title: section.title,
                position: si,
                is_extra: section.is_extra ?? false,
              })
              .select("id")
              .single();

            if (error || !data) continue;
            idMap.set(section.id, data.id);
            sectionId = data.id;
          } else {
            await createClient()
              .from("sections")
              .update({ title: section.title, position: si, is_extra: section.is_extra ?? false })
              .eq("id", sectionId);
          }

          localSectionIds.add(sectionId);

          // Save lessons
          for (let li = 0; li < section.lessons.length; li++) {
            const lesson = section.lessons[li];

            const lessonData = {
              section_id: sectionId,
              title: lesson.title,
              description: lesson.description || null,
              video_url: lesson.video_url || null,
              video_source: lesson.video_url
                ? detectVideoSource(lesson.video_url)
                : null,
              thumbnail_url: lesson.thumbnail_url || null,
              duration_minutes: lesson.duration_minutes || null,
              position: li,
              is_preview: lesson.is_preview,
            };

            if (lesson.id.startsWith("new-")) {
              const { data } = await createClient()
                .from("lessons")
                .insert(lessonData)
                .select("id")
                .single();
              if (data) {
                idMap.set(lesson.id, data.id);
                localLessonIds.add(data.id);
              }
            } else {
              await createClient()
                .from("lessons")
                .update(lessonData)
                .eq("id", lesson.id);
              localLessonIds.add(lesson.id);
            }
          }
        }

        // Reconcile: delete sections/lessons in DB that are NOT in local state
        // This handles orphans from any source (explicit deletes, past bugs, etc.)
        const { data: dbSections } = await createClient()
          .from("sections")
          .select("id, lessons(id)")
          .eq("course_id", savedCourseId);

        if (dbSections) {
          const orphanLessonIds: string[] = [];
          const orphanSectionIds: string[] = [];

          for (const dbSection of dbSections) {
            if (!localSectionIds.has(dbSection.id)) {
              orphanSectionIds.push(dbSection.id);
            } else {
              // Check for orphan lessons within kept sections
              for (const dbLesson of (dbSection.lessons || [])) {
                if (!localLessonIds.has(dbLesson.id)) {
                  orphanLessonIds.push(dbLesson.id);
                }
              }
            }
          }

          if (orphanLessonIds.length > 0) {
            await createClient()
              .from("lessons")
              .delete()
              .in("id", orphanLessonIds);
          }
          if (orphanSectionIds.length > 0) {
            await createClient()
              .from("sections")
              .delete()
              .in("id", orphanSectionIds);
          }
        }

        // Clear tracked deletes (reconciliation handles everything now)
        setDeletedSectionIds([]);
        setDeletedLessonIds([]);

        // Update local state IDs using functional setState to preserve
        // any concurrent edits the user made while save was running
        if (idMap.size > 0) {
          setSections((prev) =>
            prev.map((s) => ({
              ...s,
              id: idMap.get(s.id) || s.id,
              lessons: s.lessons.map((l) => ({
                ...l,
                id: idMap.get(l.id) || l.id,
              })),
            }))
          );
        }

        // Save exam questions
        if (examEnabled) {
          await createClient()
            .from("exam_questions")
            .delete()
            .eq("course_id", savedCourseId);

          for (let qi = 0; qi < questions.length; qi++) {
            const q = questions[qi];
            await createClient().from("exam_questions").insert({
              course_id: savedCourseId,
              question_text: q.question_text,
              options: q.options,
              position: qi,
            });
          }
        }

        // Save course_meetings (apenas pra cursos sync)
        if (courseType === "sync") {
          if (deletedMeetingIds.length > 0) {
            await createClient()
              .from("course_meetings")
              .delete()
              .in("id", deletedMeetingIds);
            setDeletedMeetingIds([]);
          }

          const meetingIdMap = new Map<string, string>();
          for (const m of meetings) {
            if (!m.starts_at) continue;
            const payload = {
              course_id: savedCourseId,
              starts_at: m.starts_at,
              title: m.title.trim() || null,
              meet_url_override: m.meet_url_override.trim() || null,
            };
            if (m.id.startsWith("new-")) {
              const { data } = await createClient()
                .from("course_meetings")
                .insert(payload)
                .select("id")
                .single();
              if (data) meetingIdMap.set(m.id, data.id);
            } else {
              await createClient()
                .from("course_meetings")
                .update(payload)
                .eq("id", m.id);
            }
          }
          if (meetingIdMap.size > 0) {
            setMeetings((prev) =>
              prev.map((m) => ({ ...m, id: meetingIdMap.get(m.id) || m.id })),
            );
          }
        }
      }

      setIsDirty(false);

      if (silent) {
        setLastAutoSaved(new Date());
      } else {
        toast.success(isEdit ? "Curso atualizado!" : "Curso criado!");
        router.push("/formacao/admin/cursos");
      }
    } finally {
      isSavingRef.current = false;
      if (silent) setIsAutoSaving(false); else setSaving(false);
    }
  }

  // Keep ref always pointing to latest saveCourse
  saveCourseRef.current = saveCourse;

  // Section helpers
  function addSection(isExtra = false) {
    markDirty();
    setSections((prev) => [
      ...prev,
      {
        id: `new-${crypto.randomUUID()}`,
        course_id: courseId || "",
        title: isExtra ? `Módulo Extra ${prev.filter(s => s.is_extra).length + 1}` : `Módulo ${prev.filter(s => !s.is_extra).length + 1}`,
        position: prev.length,
        is_extra: isExtra,
        created_at: new Date().toISOString(),
        lessons: [],
      },
    ]);
  }

  function addLesson(sectionIndex: number) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIndex] };
      section.lessons = [
        ...section.lessons,
        {
          id: `new-${crypto.randomUUID()}`,
          section_id: section.id,
          title: "",
          description: null,
          video_url: null,
          video_source: null,
          thumbnail_url: null,
          duration_minutes: null,
          position: section.lessons.length,
          is_preview: false,
          created_at: new Date().toISOString(),
          _new: true,
        },
      ];
      next[sectionIndex] = section;
      return next;
    });
  }

  function updateSection(index: number, title: string) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], title };
      return next;
    });
  }

  function removeSection(index: number) {
    markDirty();
    setSections((prev) => {
      const section = prev[index];
      // Track real (non-new) IDs for DB deletion
      if (section && !section.id.startsWith("new-")) {
        setDeletedSectionIds((ids) => [...ids, section.id]);
        // Also track all real lesson IDs within the section
        const realLessonIds = section.lessons
          .filter((l) => !l.id.startsWith("new-"))
          .map((l) => l.id);
        if (realLessonIds.length > 0) {
          setDeletedLessonIds((ids) => [...ids, ...realLessonIds]);
        }
      }
      return prev.filter((_, i) => i !== index);
    });
    setDeleteConfirmId(null);
  }

  function updateLesson(
    sectionIdx: number,
    lessonIdx: number,
    field: string,
    value: string | number | boolean | null
  ) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIdx] };
      const lessons = [...section.lessons];
      lessons[lessonIdx] = { ...lessons[lessonIdx], [field]: value };
      section.lessons = lessons;
      next[sectionIdx] = section;
      return next;
    });
  }

  function removeLesson(sectionIdx: number, lessonIdx: number) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIdx] };
      const lesson = section.lessons[lessonIdx];
      // Track real (non-new) lesson ID for DB deletion
      if (lesson && !lesson.id.startsWith("new-")) {
        setDeletedLessonIds((ids) => [...ids, lesson.id]);
      }
      section.lessons = section.lessons.filter((_, i) => i !== lessonIdx);
      next[sectionIdx] = section;
      return next;
    });
    setDeleteConfirmId(null);
  }

  // Move helpers
  function moveSection(from: number, to: number) {
    if (to < 0 || to >= sections.length) return;
    markDirty();
    setSections((prev) => arrayMove(prev, from, to));
  }

  function moveLesson(sectionIdx: number, from: number, to: number) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIdx] };
      if (to < 0 || to >= section.lessons.length) return prev;
      section.lessons = arrayMove([...section.lessons], from, to);
      next[sectionIdx] = section;
      return next;
    });
  }

  // Default duration for all lessons in a section
  function setDefaultDurationForSection(sectionIdx: number, duration: number) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIdx] };
      section.lessons = section.lessons.map((l) => ({
        ...l,
        duration_minutes: duration,
      }));
      next[sectionIdx] = section;
      return next;
    });
  }

  // Default duration for ALL lessons
  function setDefaultDurationForAll(duration: number) {
    markDirty();
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        lessons: section.lessons.map((l) => ({
          ...l,
          duration_minutes: duration,
        })),
      }))
    );
  }

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      moveSection(oldIndex, newIndex);
    }
  }

  function handleLessonDragEnd(sectionIdx: number) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const lessons = sections[sectionIdx].lessons;
        const oldIndex = lessons.findIndex((l) => l.id === active.id);
        const newIndex = lessons.findIndex((l) => l.id === over.id);
        moveLesson(sectionIdx, oldIndex, newIndex);
      }
    };
  }

  // Exam helpers
  function addQuestion() {
    markDirty();
    setQuestions((prev) => [
      ...prev,
      {
        id: `new-${crypto.randomUUID()}`,
        course_id: courseId || "",
        question_text: "",
        options: [
          { id: `opt-${crypto.randomUUID()}`, text: "", is_correct: true },
          { id: `opt-${crypto.randomUUID()}`, text: "", is_correct: false },
        ],
        position: prev.length,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  function updateQuestion(index: number, text: string) {
    markDirty();
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], question_text: text };
      return next;
    });
  }

  function addOption(qIndex: number) {
    markDirty();
    setQuestions((prev) => {
      const next = [...prev];
      const q = { ...next[qIndex] };
      q.options = [
        ...q.options,
        { id: `opt-${crypto.randomUUID()}`, text: "", is_correct: false },
      ];
      next[qIndex] = q;
      return next;
    });
  }

  function updateOption(qIndex: number, oIndex: number, text: string) {
    markDirty();
    setQuestions((prev) => {
      const next = [...prev];
      const q = { ...next[qIndex] };
      const opts = [...q.options];
      opts[oIndex] = { ...opts[oIndex], text };
      q.options = opts;
      next[qIndex] = q;
      return next;
    });
  }

  function setCorrectOption(qIndex: number, oIndex: number) {
    markDirty();
    setQuestions((prev) => {
      const next = [...prev];
      const q = { ...next[qIndex] };
      q.options = q.options.map((o, i) => ({
        ...o,
        is_correct: i === oIndex,
      }));
      next[qIndex] = q;
      return next;
    });
  }

  function removeOption(qIndex: number, oIndex: number) {
    markDirty();
    setQuestions((prev) => {
      const next = [...prev];
      const q = { ...next[qIndex] };
      q.options = q.options.filter((_, i) => i !== oIndex);
      next[qIndex] = q;
      return next;
    });
  }

  function removeQuestion(index: number) {
    markDirty();
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  // --- NEW: Video URL preview component ---
  function VideoUrlPreview({ url }: { url: string | null }) {
    if (!url || !url.trim()) return null;

    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      return (
        <div className="mt-1.5">
          <img
            src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
            alt="YouTube thumbnail"
            className="w-32 h-auto rounded border border-border/50"
          />
        </div>
      );
    }

    if (isVimeoUrl(url)) {
      return (
        <p className="mt-1.5 text-xs text-muted italic">Vimeo video</p>
      );
    }

    if (url.includes("drive.google.com")) {
      return (
        <p className="mt-1.5 text-[11px] text-amber-400/80 leading-snug">
          Google Drive detectado. Compartilhe o arquivo como{" "}
          <strong>&ldquo;Qualquer pessoa com o link&rdquo;</strong> (acesso
          de Leitor) — caso contrário os alunos verão &ldquo;Solicitar acesso&rdquo;.
        </p>
      );
    }

    return null;
  }

  function handleStatusChange(newStatus: string) {
    const typedStatus = newStatus as "draft" | "published" | "archived";
    markDirty();
    setStatus(typedStatus);
  }

  return (
    <div>
      <h1 className="font-fraunces font-bold text-2xl text-charcoal mb-8">
        {isEdit ? "Editar curso" : "Novo curso"}
      </h1>

      {/* Stepper */}
      <div className="flex gap-1 mb-8 rounded-[12px] p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {STEPS.map((s) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={`
              flex-1 py-2.5 text-sm font-medium rounded-[10px] transition-all duration-200
              ${
                step === s.id
                  ? "text-white font-semibold"
                  : "text-cream/40 hover:text-cream/70"
              }
            `}
            style={
              step === s.id
                ? { background: "linear-gradient(135deg, #C84B31, #A33D27)", boxShadow: "0 2px 8px rgba(200,75,49,0.25)" }
                : {}
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Info step */}
      {step === "info" && (
        <div className="space-y-6 max-w-2xl">
          <Input
            label="Título do curso"
            value={title}
            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
            required
            placeholder="Ex: Introdução à Psicoterapia"
          />
          <Input
            label="Slug (URL)"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); markDirty(); }}
            required
            placeholder="introducao-psicoterapia"
          />
          <Textarea
            label="Descrição curta"
            value={description}
            onChange={(e) => { setDescription(e.target.value); markDirty(); }}
            placeholder="Aparece no card do curso"
            rows={3}
          />
          <Textarea
            label="Descrição longa (Markdown)"
            value={longDescription}
            onChange={(e) => { setLongDescription(e.target.value); markDirty(); }}
            placeholder="Descrição completa. Suporta Markdown."
            rows={8}
          />
          <CategoryPicker
            categories={availableCategories}
            value={category}
            onChange={(v) => { setCategory(v); markDirty(); }}
          />
          <ImageUpload
            label="Thumbnail do curso (capa vertical 720x1040)"
            value={thumbnailUrl}
            onChange={(url) => { setThumbnailUrl(url); markDirty(); }}
            folder="thumbnails"
            aspectHint="9/13"
            placeholder="https://... ou faça upload"
          />
          <ImageUpload
            label="Thumbnail padrão das aulas (opcional)"
            value={defaultLessonThumbnail}
            onChange={(url) => { setDefaultLessonThumbnail(url); markDirty(); }}
            folder="lesson-thumbnails"
            aspectHint="16/9"
            placeholder="https://... (usada em aulas sem thumbnail própria)"
          />

          {/* Free/Paid toggle */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-charcoal">Tipo:</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setIsFree(true); markDirty(); }}
                className={`px-4 py-2 rounded-button text-sm font-medium transition-all ${
                  isFree
                    ? "bg-teal text-white"
                    : "bg-cream-alt text-muted"
                }`}
              >
                Gratuito
              </button>
              <button
                type="button"
                onClick={() => { setIsFree(false); markDirty(); }}
                className={`px-4 py-2 rounded-button text-sm font-medium transition-all ${
                  !isFree
                    ? "bg-accent text-white"
                    : "bg-cream-alt text-muted"
                }`}
              >
                Pago
              </button>
            </div>
          </div>

          {!isFree && (
            <Input
              label="Preço (R$)"
              type="number"
              value={(priceCents / 100).toFixed(2)}
              onChange={(e) => {
                setPriceCents(Math.round(parseFloat(e.target.value || "0") * 100));
                markDirty();
              }}
              step="0.01"
              min="0"
              placeholder="99.00"
            />
          )}

          {isAdmin && instructors.length > 0 && (
            <Select
              label="Professor responsável"
              value={instructorId}
              onChange={(e) => { setInstructorId(e.target.value); markDirty(); }}
              options={instructors}
              placeholder="Selecione um professor"
            />
          )}

          {/* Show instructor toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setShowInstructor(!showInstructor); markDirty(); }}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{
                background: showInstructor ? "rgba(46,158,143,0.6)" : "rgba(255,255,255,0.1)",
              }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ left: showInstructor ? "22px" : "2px" }}
              />
            </button>
            <label className="text-sm text-cream/60">
              Exibir nome do professor nos cards
            </label>
          </div>

          <Select
            label="Status"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            options={[
              { value: "draft", label: "Rascunho" },
              { value: "published", label: "Publicado" },
              { value: "archived", label: "Arquivado" },
            ]}
          />

          <Select
            label="Tipo do curso"
            value={courseType}
            onChange={(e) => {
              const val = e.target.value as "async" | "sync" | "collection";
              setCourseType(val);
              markDirty();
              const currentStep: string = step;
              if ((val === "sync" || val === "collection") && ["exam", "certificate"].includes(currentStep)) {
                setStep("content");
              }
              if (val !== "sync" && currentStep === "meetings") {
                setStep("content");
              }
            }}
            options={[
              { value: "async", label: "Gravado (assíncrono)" },
              { value: "sync", label: "Ao vivo + Gravação (síncrono)" },
              { value: "collection", label: "Coleção (certificado por volume)" },
            ]}
          />

          {courseType === "collection" && (
            <div
              className="p-5 rounded-[12px] space-y-4"
              style={{ background: "rgba(46,158,143,0.04)", border: "1px solid rgba(46,158,143,0.15)" }}
            >
              <p className="text-sm font-medium text-teal">Configuração da coleção</p>
              <p className="text-xs text-cream/35">
                O aluno ganha um certificado a cada X aulas assistidas. É acumulativo: assistiu mais X, ganha outro.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-cream/50 block mb-1.5">Aulas para certificado</label>
                  <input
                    type="number"
                    min="1"
                    value={certLessonsRequired ?? ""}
                    onChange={(e) => { setCertLessonsRequired(parseInt(e.target.value) || null); markDirty(); }}
                    placeholder="Ex: 10"
                    className="w-full px-4 py-2.5 rounded-[10px] text-sm text-cream placeholder:text-cream/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                  />
                </div>
                <div>
                  <label className="text-xs text-cream/50 block mb-1.5">Horas por certificado</label>
                  <input
                    type="number"
                    min="1"
                    value={certHoursValue ?? ""}
                    onChange={(e) => { setCertHoursValue(parseInt(e.target.value) || null); markDirty(); }}
                    placeholder="Ex: 20"
                    className="w-full px-4 py-2.5 rounded-[10px] text-sm text-cream placeholder:text-cream/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                  />
                </div>
              </div>
            </div>
          )}

          <Input
            label="WhatsApp de contato"
            value={whatsappNumber}
            onChange={(e) => { setWhatsappNumber(e.target.value); markDirty(); }}
            placeholder="5531999999999"
          />

          <label className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              checked={isDiscontinued}
              onChange={(e) => { setIsDiscontinued(e.target.checked); markDirty(); }}
              className="w-5 h-5 accent-amber-500"
            />
            <div>
              <span className="font-medium text-cream text-sm">Curso descontinuado</span>
              <p className="text-xs text-cream/30">Não aparece no catálogo principal. Fica na página de acervo.</p>
            </div>
          </label>

          {/* Learning points */}
          <div>
            <label className="text-sm font-medium text-charcoal block mb-2">
              O que você vai aprender
            </label>
            <div className="space-y-2">
              {learningPoints.map((point, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={point}
                    onChange={(e) => {
                      const next = [...learningPoints];
                      next[i] = e.target.value;
                      setLearningPoints(next);
                      markDirty();
                    }}
                    placeholder="Ex: Entender os fundamentos da psicoterapia"
                    className="flex-1 px-4 py-2 rounded-[10px] text-sm text-cream placeholder:text-cream/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-all duration-250"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1.5px solid rgba(255,255,255,0.08)",
                      color: "rgba(253,251,247,0.9)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLearningPoints((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      );
                      markDirty();
                    }}
                    className="p-2 text-muted hover:text-accent"
                    aria-label="Remover"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => { setLearningPoints((prev) => [...prev, ""]); markDirty(); }}
                className="text-sm text-teal hover:text-teal-dark flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Adicionar ponto
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Content step */}
      {step === "content" && (
        <div className="space-y-6">
          {/* Default duration toolbar */}
          <div
            className="flex flex-wrap items-center gap-3 p-4 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Clock className="h-4 w-4 text-cream/30" />
            <span className="text-xs text-cream/50 font-medium">Duração padrão:</span>
            <input
              type="number"
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(parseInt(e.target.value) || 0)}
              className="w-20 px-2.5 py-1.5 text-xs rounded-lg text-cream placeholder:text-cream/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(253,251,247,0.9)" }}
              min="1"
            />
            <span className="text-xs text-cream/30">min</span>
            <button
              type="button"
              onClick={() => setDefaultDurationForAll(defaultDuration)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ background: "rgba(200,75,49,0.12)", border: "1px solid rgba(200,75,49,0.2)", color: "#C84B31" }}
            >
              Aplicar a todas as aulas
            </button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((section, si) => (
                <SortableItem key={section.id} id={section.id}>
                  {({ dragHandleProps }) => (
                  <div
                    className="rounded-card p-6"
                    style={{
                      background: section.is_extra ? "rgba(139,92,246,0.04)" : "rgba(255,255,255,0.04)",
                      border: section.is_extra ? "1px solid rgba(139,92,246,0.15)" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span className="cursor-grab active:cursor-grabbing touch-none" {...dragHandleProps}>
                        <GripVertical className="h-5 w-5 text-cream/20 hover:text-cream/50 transition-colors" />
                      </span>
                      {/* Move section buttons */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveSection(si, si - 1)}
                          disabled={si === 0}
                          className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Mover para cima"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(si, si + 1)}
                          disabled={si === sections.length - 1}
                          className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                      {section.is_extra && (
                        <span
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                          style={{ background: "rgba(139,92,246,0.15)", color: "rgb(167,139,250)", border: "1px solid rgba(139,92,246,0.25)" }}
                        >
                          <Sparkles className="h-3 w-3" />
                          Extra
                        </span>
                      )}
                      <input
                        value={section.title}
                        onChange={(e) => updateSection(si, e.target.value)}
                        className="flex-1 font-semibold text-cream bg-transparent border-b border-transparent hover:border-white/10 focus:border-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 py-1"
                        placeholder="Nome da seção"
                      />
                      {/* Toggle extra */}
                      <button
                        type="button"
                        onClick={() => {
                          markDirty();
                          setSections((prev) => {
                            const next = [...prev];
                            next[si] = { ...next[si], is_extra: !next[si].is_extra };
                            return next;
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex-shrink-0"
                        style={{
                          background: section.is_extra ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
                          border: section.is_extra ? "1px solid rgba(139,92,246,0.2)" : "1px solid rgba(255,255,255,0.06)",
                          color: section.is_extra ? "rgb(167,139,250)" : "rgba(253,251,247,0.3)",
                        }}
                        title={section.is_extra ? "Módulo extra: não obrigatório para certificado" : "Tornar módulo extra (opcional)"}
                      >
                        {section.is_extra ? "Extra ✓" : "Marcar extra"}
                      </button>
                      {/* Default duration for section */}
                      <button
                        type="button"
                        onClick={() => setDefaultDurationForSection(si, defaultDuration)}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex-shrink-0"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(253,251,247,0.3)" }}
                        title={`Aplicar ${defaultDuration}min a todas as aulas deste módulo`}
                      >
                        <Clock className="h-3 w-3 inline mr-1" />
                        {defaultDuration}min
                      </button>
                      {/* Delete section with confirmation */}
                      {deleteConfirmId === `section-${section.id}` ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-cream/40">Excluir seção?</span>
                          <button
                            onClick={() => removeSection(si)}
                            className="px-2 py-0.5 bg-accent text-white rounded font-medium hover:bg-accent/90"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-0.5 bg-white/10 text-cream/50 rounded font-medium hover:bg-white/15"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(`section-${section.id}`)}
                          className="p-1 text-cream/30 hover:text-accent"
                          aria-label="Remover seção"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Lessons */}
                    <div className="space-y-3 ml-8">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd(si)}>
                        <SortableContext items={section.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                          {section.lessons.map((lesson, li) => (
                            <SortableItem key={lesson.id} id={lesson.id}>
                              {({ dragHandleProps: lessonDragProps }) => (
                              <div
                                className="rounded-button p-4 space-y-3"
                                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="cursor-grab active:cursor-grabbing touch-none" {...lessonDragProps}>
                                    <GripVertical className="h-4 w-4 text-cream/20 hover:text-cream/50 transition-colors" />
                                  </span>
                                  {/* Move lesson buttons */}
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => moveLesson(si, li, li - 1)}
                                      disabled={li === 0}
                                      className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                      title="Mover para cima"
                                    >
                                      <ArrowUp className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveLesson(si, li, li + 1)}
                                      disabled={li === section.lessons.length - 1}
                                      className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                      title="Mover para baixo"
                                    >
                                      <ArrowDown className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                  <input
                                    value={lesson.title}
                                    onChange={(e) =>
                                      updateLesson(si, li, "title", e.target.value)
                                    }
                                    placeholder="Título da aula"
                                    className="flex-1 text-sm text-cream bg-transparent border-b border-transparent hover:border-white/10 focus:border-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 py-1 placeholder:text-cream/25"
                                  />
                                  {/* Delete lesson with confirmation */}
                                  {deleteConfirmId === `lesson-${lesson.id}` ? (
                                    <div className="flex items-center gap-1.5 text-xs">
                                      <span className="text-cream/40">Excluir?</span>
                                      <button
                                        onClick={() => removeLesson(si, li)}
                                        className="px-2 py-0.5 bg-accent text-white rounded font-medium hover:bg-accent/90"
                                      >
                                        Sim
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="px-2 py-0.5 bg-white/10 text-cream/50 rounded font-medium hover:bg-white/15"
                                      >
                                        Não
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirmId(`lesson-${lesson.id}`)}
                                      className="p-1 text-cream/30 hover:text-accent"
                                      aria-label="Remover aula"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <input
                                      value={lesson.video_url || ""}
                                      onChange={(e) =>
                                        updateLesson(si, li, "video_url", e.target.value)
                                      }
                                      placeholder="URL do vídeo (YouTube / Drive)"
                                      className="w-full px-3 py-2 text-xs rounded-button focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus:border-teal text-cream placeholder:text-cream/25"
                                      style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                                    />
                                    {/* Video URL preview */}
                                    <VideoUrlPreview url={lesson.video_url} />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-cream/30 uppercase tracking-wider mb-1 block">Duração (min)</label>
                                    <input
                                      type="number"
                                      value={lesson.duration_minutes || ""}
                                      onChange={(e) =>
                                        updateLesson(
                                          si,
                                          li,
                                          "duration_minutes",
                                          parseInt(e.target.value) || null
                                        )
                                      }
                                      placeholder="Ex: 45"
                                      className="w-full px-3 py-2 text-xs rounded-button focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus:border-teal text-cream placeholder:text-cream/25"
                                      style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                                    />
                                  </div>
                                </div>

                                <input
                                  value={lesson.thumbnail_url || ""}
                                  onChange={(e) =>
                                    updateLesson(si, li, "thumbnail_url", e.target.value)
                                  }
                                  placeholder="Thumbnail da aula (opcional — sobrescreve o padrão do curso)"
                                  className="w-full px-3 py-2 text-xs rounded-button focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus:border-teal text-cream placeholder:text-cream/25"
                                  style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                                />

                                <textarea
                                  value={lesson.description || ""}
                                  onChange={(e) =>
                                    updateLesson(si, li, "description", e.target.value)
                                  }
                                  placeholder="Descrição da aula (Markdown)"
                                  rows={2}
                                  className="w-full px-3 py-2 text-xs rounded-button resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus:border-teal text-cream placeholder:text-cream/25"
                                  style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                                />

                                <label className="flex items-center gap-2 text-xs text-cream/50">
                                  <input
                                    type="checkbox"
                                    checked={lesson.is_preview}
                                    onChange={(e) =>
                                      updateLesson(si, li, "is_preview", e.target.checked)
                                    }
                                    className="accent-teal"
                                  />
                                  Preview gratuito
                                </label>
                              </div>
                              )}
                            </SortableItem>
                          ))}
                        </SortableContext>
                      </DndContext>

                      <button
                        onClick={() => addLesson(si)}
                        className="flex items-center gap-1 text-sm text-teal hover:text-teal-dark py-2"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Nova aula
                      </button>
                    </div>
                  </div>
                  )}
                </SortableItem>
              ))}
            </SortableContext>
          </DndContext>

          <div className="flex gap-3 flex-wrap">
            <Button variant="secondary" onClick={() => addSection(false)}>
              <Plus className="h-4 w-4" />
              Nova seção
            </Button>
            <button
              type="button"
              onClick={() => addSection(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium transition-all hover:opacity-80"
              style={{
                background: "rgba(139,92,246,0.08)",
                border: "1px solid rgba(139,92,246,0.2)",
                color: "rgb(167,139,250)",
              }}
            >
              <Sparkles className="h-4 w-4" />
              Nova seção extra
            </button>
          </div>

          {sections.some(s => s.is_extra) && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl text-sm"
              style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}
            >
              <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "rgb(167,139,250)" }} />
              <div className="text-cream/50">
                <span className="font-semibold" style={{ color: "rgb(167,139,250)" }}>Seções extras</span> não são obrigatórias para conclusão do curso nem para a prova. Se o aluno completá-las, as horas dessas aulas são somadas ao certificado.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meetings & Community step (apenas sync) */}
      {step === "meetings" && courseType === "sync" && (
        <div className="space-y-8 max-w-3xl">
          {/* Bloco Comunidade */}
          <div
            className="p-5 rounded-[12px] space-y-4"
            style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.18)" }}
          >
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "rgb(167,139,250)" }}>
                Comunidade
              </p>
              <p className="text-xs text-cream/40">
                Esses links aparecem clicáveis no card do curso na página /formacao.
              </p>
            </div>

            <Input
              label="Link do grupo do WhatsApp"
              placeholder="https://chat.whatsapp.com/..."
              value={whatsappGroupUrl}
              onChange={(e) => { setWhatsappGroupUrl(e.target.value); markDirty(); }}
            />

            <Input
              label="Link do Meet padrão"
              placeholder="https://meet.google.com/..."
              value={meetUrl}
              onChange={(e) => { setMeetUrl(e.target.value); markDirty(); }}
            />

            <Textarea
              label="Sobre o(a) professor(a) (opcional)"
              placeholder="Bio livre do professor pra contexto desse curso. Aceita parágrafos."
              rows={5}
              value={instructorBio}
              onChange={(e) => { setInstructorBio(e.target.value); markDirty(); }}
            />
          </div>

          {/* Bloco Encontros */}
          <div
            className="p-5 rounded-[12px] space-y-4"
            style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.18)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "rgb(167,139,250)" }}>
                  Próximos encontros
                </p>
                <p className="text-xs text-cream/40">
                  Quando o horário de um encontro chega, o curso sobe automaticamente pro destaque "AO VIVO AGORA" pelo tempo definido abaixo.
                </p>
              </div>
              <div className="w-32 flex-shrink-0">
                <label className="text-xs text-cream/50 block mb-1.5">Duração (min)</label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={liveSessionDuration}
                  onChange={(e) => { setLiveSessionDuration(parseInt(e.target.value) || 120); markDirty(); }}
                  className="w-full px-3 py-2 rounded-[10px] text-sm focus:outline-none focus-visible:ring-2"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {meetings.length === 0 && (
                <p className="text-xs text-cream/30 italic py-3 text-center">
                  Nenhum encontro agendado. Adicione um abaixo.
                </p>
              )}
              {meetings.map((m, idx) => (
                <div
                  key={m.id}
                  className="grid grid-cols-12 gap-2 items-start p-3 rounded-[10px]"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="col-span-12 sm:col-span-4">
                    <label className="text-[10px] text-cream/40 uppercase tracking-wider block mb-1">Data e hora</label>
                    <input
                      type="datetime-local"
                      value={m.starts_at ? m.starts_at.slice(0, 16) : ""}
                      onChange={(e) => {
                        const iso = e.target.value ? new Date(e.target.value).toISOString() : "";
                        setMeetings((prev) => prev.map((x, i) => i === idx ? { ...x, starts_at: iso } : x));
                        markDirty();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-[8px] text-xs focus:outline-none focus-visible:ring-2"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-4">
                    <label className="text-[10px] text-cream/40 uppercase tracking-wider block mb-1">Título (opcional)</label>
                    <input
                      type="text"
                      value={m.title}
                      placeholder="Ex: Aula 5 — Casos clínicos"
                      onChange={(e) => {
                        const v = e.target.value;
                        setMeetings((prev) => prev.map((x, i) => i === idx ? { ...x, title: v } : x));
                        markDirty();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-[8px] text-xs focus:outline-none focus-visible:ring-2"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                    />
                  </div>
                  <div className="col-span-11 sm:col-span-3">
                    <label className="text-[10px] text-cream/40 uppercase tracking-wider block mb-1">Meet específico (opcional)</label>
                    <input
                      type="text"
                      value={m.meet_url_override}
                      placeholder="Override do Meet padrão"
                      onChange={(e) => {
                        const v = e.target.value;
                        setMeetings((prev) => prev.map((x, i) => i === idx ? { ...x, meet_url_override: v } : x));
                        markDirty();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-[8px] text-xs focus:outline-none focus-visible:ring-2"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-end h-full">
                    <button
                      onClick={() => {
                        if (!m.id.startsWith("new-")) {
                          setDeletedMeetingIds((prev) => [...prev, m.id]);
                        }
                        setMeetings((prev) => prev.filter((_, i) => i !== idx));
                        markDirty();
                      }}
                      className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors"
                      title="Remover encontro"
                    >
                      <Trash2 size={14} className="text-cream/40 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                const newId = `new-${Date.now()}`;
                const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
                inOneHour.setMinutes(0, 0, 0);
                setMeetings((prev) => [...prev, {
                  id: newId,
                  starts_at: inOneHour.toISOString(),
                  title: "",
                  meet_url_override: "",
                  _new: true,
                }]);
                markDirty();
              }}
              className="w-full py-2.5 rounded-[10px] text-sm font-medium flex items-center justify-center gap-2 transition-all"
              style={{ background: "rgba(139,92,246,0.08)", border: "1px dashed rgba(139,92,246,0.3)", color: "rgb(167,139,250)" }}
            >
              <Plus size={14} /> Adicionar encontro
            </button>
          </div>
        </div>
      )}

      {/* Exam step */}
      {step === "exam" && (
        <div className="space-y-6 max-w-2xl">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={examEnabled}
              onChange={(e) => { setExamEnabled(e.target.checked); markDirty(); }}
              className="w-5 h-5 accent-teal"
            />
            <span className="font-medium text-cream">
              Este curso tem prova final
            </span>
          </label>

          {examEnabled && (
            <>
              <div>
                <label className="text-sm font-medium text-cream/70 block mb-2">
                  Nota mínima para aprovação: {examPassingScore}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={examPassingScore}
                  onChange={(e) => {
                    setExamPassingScore(parseInt(e.target.value));
                    markDirty();
                  }}
                  className="w-full accent-teal"
                />
              </div>

              {/* Questions */}
              <div className="space-y-4">
                {questions.map((q, qi) => (
                  <div
                    key={q.id}
                    className="rounded-card p-6"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <span className="text-sm font-bold text-teal">
                        {qi + 1}.
                      </span>
                      <div className="flex-1">
                        <textarea
                          value={q.question_text}
                          onChange={(e) => updateQuestion(qi, e.target.value)}
                          placeholder="Texto da pergunta"
                          rows={2}
                          className="w-full px-3 py-2 text-sm rounded-button resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus:border-teal text-cream placeholder:text-cream/25"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                        />
                      </div>
                      <button
                        onClick={() => removeQuestion(qi)}
                        className="p-1 text-cream/30 hover:text-accent"
                        aria-label="Remover pergunta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2 ml-6">
                      {q.options.map((opt: ExamOption, oi: number) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={opt.is_correct}
                            onChange={() => setCorrectOption(qi, oi)}
                            className="accent-teal"
                            aria-label={`Marcar opção ${oi + 1} como correta`}
                          />
                          <input
                            value={opt.text}
                            onChange={(e) =>
                              updateOption(qi, oi, e.target.value)
                            }
                            placeholder={`Opção ${oi + 1}`}
                            className="flex-1 px-3 py-1.5 text-sm rounded-button focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus:border-teal text-cream placeholder:text-cream/25"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                          />
                          {q.options.length > 2 && (
                            <button
                              onClick={() => removeOption(qi, oi)}
                              className="p-1 text-cream/30 hover:text-accent"
                              aria-label="Remover opção"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      {q.options.length < 6 && (
                        <button
                          onClick={() => addOption(qi)}
                          className="text-xs text-teal hover:text-teal-dark flex items-center gap-1 mt-1"
                        >
                          <Plus className="h-3 w-3" />
                          Opção
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <Button variant="secondary" onClick={addQuestion}>
                  <Plus className="h-4 w-4" />
                  Nova pergunta
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Certificate step */}
      {step === "certificate" && (
        <CertificateStep
          enabled={certificateEnabled}
          hours={certificateHours}
          bodyText={certificateBodyText}
          title={title}
          onEnabledChange={(v) => {
            setCertificateEnabled(v);
            markDirty();
          }}
          onHoursChange={(v) => {
            setCertificateHours(v);
            markDirty();
          }}
          onBodyTextChange={(v) => {
            setCertificateBodyText(v);
            markDirty();
          }}
        />
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push("/formacao/admin/cursos")}
          >
            Cancelar
          </Button>
          {/* Unsaved changes indicator */}
          {isDirty && (
            <span className="text-xs text-accent font-medium animate-pulse">
              Alterações não salvas
            </span>
          )}
          {/* Autosave indicator */}
          {isAutoSaving && (
            <span className="text-xs text-cream/30 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-cream/30 animate-pulse" />
              Salvando...
            </span>
          )}
          {!isAutoSaving && lastAutoSaved && !isDirty && (
            <span className="text-xs text-cream/30">
              Salvo automaticamente às{" "}
              {lastAutoSaved.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          {step !== "info" && (
            <Button
              variant="ghost"
              onClick={() => {
                const idx = STEPS.findIndex((s) => s.id === step);
                if (idx > 0) setStep(STEPS[idx - 1].id);
              }}
            >
              Anterior
            </Button>
          )}
          {step !== STEPS[STEPS.length - 1].id ? (
            <Button
              onClick={() => {
                const idx = STEPS.findIndex((s) => s.id === step);
                if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].id);
              }}
            >
              Próximo
            </Button>
          ) : (
            <Button loading={saving} onClick={() => saveCourse()}>
              {isEdit ? "Salvar alterações" : "Criar curso"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
