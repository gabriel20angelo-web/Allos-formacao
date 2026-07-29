"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import {
  MessageCircle,
  GraduationCap,
  HeartHandshake,
  ArrowUpRight,
  Radio,
  Play,
  Award,
} from "lucide-react";
import {
  WHATSAPP_FORMACAO_URL,
  PROCESSO_SELETIVO_PSI_URL,
  TERAPIA_SOCIAL_URL,
} from "@/lib/allos-links";

const TERRACOTA = "#C84B31";
const TEAL = "#2E9E8F";
const WHATSAPP = "#25D366";

const PILARES = [
  {
    icon: <Play className="h-3.5 w-3.5" />,
    title: "Cursos gravados",
    text: "Liberados por completo, pra assistir no seu tempo.",
  },
  {
    icon: <Radio className="h-3.5 w-3.5" />,
    title: "Grupos síncronos",
    text: "Encontros ao vivo toda semana, no Google Meet.",
  },
  {
    icon: <Award className="h-3.5 w-3.5" />,
    title: "Certificação",
    text: "Cada hora de estudo conta e vira certificado digital.",
  },
];

const CAMINHOS = [
  {
    href: PROCESSO_SELETIVO_PSI_URL,
    icon: <GraduationCap className="h-5 w-5" />,
    eyebrow: "Está na graduação de Psicologia?",
    title: "Estágio na clínica escola",
    text: "A Allos abre processo seletivo para estudantes de Psicologia que querem construir trajetória clínica. São até dois anos de estágio, com trilha de desenvolvimento e supervisão.",
    cta: "Conhecer o processo seletivo",
    color: TERRACOTA,
    soft: "rgba(200,75,49,0.07)",
    iconBg: "rgba(200,75,49,0.16)",
    border: "rgba(200,75,49,0.18)",
  },
  {
    href: TERAPIA_SOCIAL_URL,
    icon: <HeartHandshake className="h-5 w-5" />,
    eyebrow: "Procurando terapia pra você?",
    title: "Psicoterapia a valor social",
    text: "A Allos mantém um projeto de psicoterapia acessível, com valor social. O atendimento é feito pela nossa equipe, online ou presencial.",
    cta: "Falar sobre a terapia social",
    color: TEAL,
    soft: "rgba(46,158,143,0.07)",
    iconBg: "rgba(46,158,143,0.16)",
    border: "rgba(46,158,143,0.18)",
  },
];

/**
 * Bloco institucional fixo, exibido no fim da apresentação de todo curso.
 * Situa o curso dentro da formação, leva pro grupo geral do WhatsApp e
 * abre os outros dois caminhos da Allos (estágio e terapia social).
 */
export default function SobreAllosBlock() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-3xl overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(253,251,247,0.028) 0%, rgba(253,251,247,0.006) 100%)",
        border: "1px solid rgba(253,251,247,0.07)",
      }}
    >
      {/* Fio de luz no topo */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(200,75,49,0.35) 25%, rgba(46,158,143,0.45) 55%, transparent 100%)",
        }}
      />
      {/* Brilho ambiente */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 12% 0%, rgba(200,75,49,0.07) 0%, transparent 65%), radial-gradient(ellipse 55% 45% at 88% 100%, rgba(46,158,143,0.06) 0%, transparent 65%)",
        }}
      />

      <div className="relative p-6 sm:p-8 md:p-10">
        {/* Cabeçalho */}
        <div className="text-center max-w-2xl mx-auto">
          <p
            className="font-dm font-semibold text-[11px] tracking-[.22em] uppercase mb-3"
            style={{ color: TERRACOTA }}
          >
            Associação Allos
          </p>
          <h3
            className="font-fraunces font-bold text-[#FDFBF7] mb-3 leading-tight"
            style={{ fontSize: "clamp(21px,2.4vw,29px)" }}
          >
            Este curso faz parte de uma formação inteira
          </h3>
          <p
            className="font-dm text-sm leading-relaxed"
            style={{ color: "rgba(253,251,247,0.5)" }}
          >
            A Allos mantém uma formação contínua e gratuita em psicologia clínica: cursos gravados
            que ficam liberados, grupos de estudo ao vivo toda semana e certificado para cada hora
            estudada. Você não precisa parar neste curso.
          </p>
        </div>

        {/* Três pilares */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
          {PILARES.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl px-4 py-3.5"
              style={{
                background: "rgba(253,251,247,0.02)",
                border: "1px solid rgba(253,251,247,0.05)",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ color: TEAL }}>{p.icon}</span>
                <p className="font-dm font-semibold text-[13px] text-[#FDFBF7]">{p.title}</p>
              </div>
              <p
                className="font-dm text-[11.5px] leading-relaxed"
                style={{ color: "rgba(253,251,247,0.42)" }}
              >
                {p.text}
              </p>
            </div>
          ))}
        </div>

        {/* Grupo geral do WhatsApp */}
        <div
          className="mt-8 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5"
          style={{
            background: "rgba(37,211,102,0.05)",
            border: "1px solid rgba(37,211,102,0.16)",
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(37,211,102,0.12)",
                  border: "1px solid rgba(37,211,102,0.22)",
                }}
              >
                <MessageCircle className="h-4 w-4" style={{ color: WHATSAPP }} />
              </div>
              <p className="font-fraunces font-bold text-base text-[#FDFBF7]">
                Grupo geral da formação no WhatsApp
              </p>
            </div>
            <p
              className="font-dm text-[13px] leading-relaxed"
              style={{ color: "rgba(253,251,247,0.5)" }}
            >
              É por lá que mandamos todos os grupos de estudo síncronos da semana, com o link do Meet
              de cada encontro, os materiais de leitura e os avisos quando algum horário muda.
            </p>
          </div>

          <a
            href={WHATSAPP_FORMACAO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-dm font-semibold text-sm transition-all hover:-translate-y-0.5 flex-shrink-0"
            style={{
              background: "rgba(37,211,102,0.14)",
              color: WHATSAPP,
              border: "1px solid rgba(37,211,102,0.28)",
            }}
          >
            <MessageCircle className="h-4 w-4" />
            Entrar no grupo
          </a>
        </div>

        {/* Separador */}
        <div className="flex items-center gap-4 mt-9 mb-6">
          <div
            className="h-px flex-1"
            style={{ background: "linear-gradient(90deg, transparent, rgba(253,251,247,0.09))" }}
          />
          <span
            className="font-dm text-[10px] font-semibold uppercase tracking-[.2em] whitespace-nowrap"
            style={{ color: "rgba(253,251,247,0.28)" }}
          >
            Outros caminhos na Allos
          </span>
          <div
            className="h-px flex-1"
            style={{ background: "linear-gradient(90deg, rgba(253,251,247,0.09), transparent)" }}
          />
        </div>

        {/* Dois caminhos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CAMINHOS.map((c) => (
            <a
              key={c.href}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl p-5 sm:p-6 flex flex-col transition-all hover:-translate-y-1"
              style={{ background: c.soft, border: `1px solid ${c.border}` }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mb-3"
                style={{ background: c.iconBg, border: `1px solid ${c.border}`, color: c.color }}
              >
                {c.icon}
              </div>

              <p
                className="font-dm text-[11px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: c.color }}
              >
                {c.eyebrow}
              </p>
              <p className="font-fraunces font-bold text-base text-[#FDFBF7] mb-2">{c.title}</p>
              <p
                className="font-dm text-[13px] leading-relaxed flex-1"
                style={{ color: "rgba(253,251,247,0.48)" }}
              >
                {c.text}
              </p>

              <span
                className="inline-flex items-center gap-1.5 font-dm text-[13px] font-semibold mt-4 transition-all group-hover:gap-2.5"
                style={{ color: c.color }}
              >
                {c.cta}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
