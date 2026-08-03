// Página pública de manifestação sobre uma ocorrência.
//
// Quem recebe um aviso de atividade atípica, está com o acesso bloqueado ou
// com o certificado retido responde por aqui, não por e-mail. Duas razões
// práticas: quem está bloqueado não consegue entrar na plataforma para se
// explicar, e a resposta chega estruturada ao painel em vez de virar thread na
// caixa de entrada de alguém.
//
// Por isso a página é aberta, sem login. A defesa contra abuso mora na rota:
// honeypot e teto por e-mail em 24h.

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Clock, MessageSquare } from "lucide-react";

const ORIGENS = ["aviso", "bloqueio", "certificado"] as const;
type Origem = (typeof ORIGENS)[number];

// A abertura muda com a origem porque quem chega já sabe o que recebeu: repetir
// o contexto certo evita que a pessoa gaste o relato explicando qual é o caso.
const ABERTURA: Record<Origem, { titulo: string; texto: string }> = {
  aviso: {
    titulo: "Responder ao aviso",
    texto:
      "Você recebeu um aviso sobre os registros da sua conta na plataforma. Este é o lugar de apresentar a sua versão: como acompanhou o conteúdo, se houve falha técnica, o que mais achar relevante para a análise.",
  },
  bloqueio: {
    titulo: "Pedir revisão do acesso",
    texto:
      "Seu acesso à plataforma está em revisão, e por isso você não consegue se manifestar por dentro dela. Use este formulário para contar o que aconteceu e pedir a revisão da decisão.",
  },
  certificado: {
    titulo: "Responder sobre o certificado",
    texto:
      "A emissão do seu certificado está retida enquanto verificamos os registros do curso. Conte aqui o que aconteceu para que a verificação considere a sua versão antes de decidir.",
  },
};

const MIN_RELATO = 20;

function OcorrenciaForm() {
  const searchParams = useSearchParams();
  const bruta = searchParams.get("origem");
  // Origem desconhecida cai em "aviso": é o caso mais genérico e não trava
  // ninguém que chegou por um link antigo ou digitado errado.
  const origem: Origem = (ORIGENS as readonly string[]).includes(bruta || "")
    ? (bruta as Origem)
    : "aviso";

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [relato, setRelato] = useState("");
  // Honeypot: fica escondido, humano nunca preenche, bot preenche tudo.
  const [website, setWebsite] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const podeEnviar =
    nome.trim().length >= 3 &&
    emailValido &&
    relato.trim().length >= MIN_RELATO &&
    !enviando;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/formacao/api/ocorrencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
          relato: relato.trim(),
          origem,
          website,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(payload?.error || "Não foi possível registrar agora.");
        return;
      }
      setEnviado(true);
    } catch {
      setErro("Erro de rede ao enviar. Verifique a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  // Confirmação no lugar do formulário, sem redirecionar: a pessoa precisa ver
  // que o envio terminou e qual e-mail ficou registrado para a resposta.
  if (enviado) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto px-6 py-16 text-center"
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{
            background: "rgba(46,158,143,0.08)",
            border: "1px solid rgba(46,158,143,0.2)",
          }}
        >
          <Check className="h-8 w-8" style={{ color: "#2E9E8F" }} />
        </div>

        <h1 className="font-fraunces font-bold text-2xl text-cream mb-3 tracking-tight">
          Manifestação registrada
        </h1>

        <p className="text-sm text-cream/55 font-dm leading-relaxed mb-4">
          Seu relato foi registrado e já está na fila de quem analisa esses
          casos. A resposta chega em{" "}
          <span className="text-cream/80">{email.trim()}</span>, então vale
          conferir também a caixa de spam.
        </p>

        <p className="text-[12px] text-cream/35 font-dm leading-relaxed flex items-center justify-center gap-1.5">
          <Clock className="h-3 w-3" />
          Análise em até 5 dias úteis
        </p>

        <div className="mt-8">
          <Link
            href="/formacao"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-cream"
            style={{
              background: "linear-gradient(135deg, #C84B31, #A33D27)",
              boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
            }}
          >
            Voltar para a formação
          </Link>
        </div>
      </motion.div>
    );
  }

  const abertura = ABERTURA[origem];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto px-6 py-16"
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{
          background: "rgba(200,75,49,0.08)",
          border: "1px solid rgba(200,75,49,0.2)",
        }}
      >
        <MessageSquare className="h-8 w-8" style={{ color: "#C84B31" }} />
      </div>

      <h1 className="font-fraunces font-bold text-2xl text-cream mb-3 text-center tracking-tight">
        {abertura.titulo}
      </h1>

      <div className="space-y-4 text-sm text-cream/55 font-dm leading-relaxed mb-8">
        <p>{abertura.texto}</p>
        <p className="text-[13px] text-cream/40">
          Esta página existe para que a sua resposta chegue estruturada e vá
          direto para quem analisa o caso, em vez de virar uma thread de e-mail.
          A análise leva até 5 dias úteis.
        </p>
      </div>

      <form
        onSubmit={enviar}
        className="rounded-[16px] p-6 sm:p-8 space-y-5"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div>
          <label
            htmlFor="oc-nome"
            className="block text-[12px] font-medium text-cream/50 font-dm mb-1.5"
          >
            Nome completo
          </label>
          <input
            id="oc-nome"
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            placeholder="Como está no seu cadastro"
            className="w-full px-4 py-3 dark-input rounded-[12px] text-sm font-dm"
          />
        </div>

        <div>
          <label
            htmlFor="oc-email"
            className="block text-[12px] font-medium text-cream/50 font-dm mb-1.5"
          >
            E-mail
          </label>
          <input
            id="oc-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="voce@exemplo.com"
            className="w-full px-4 py-3 dark-input rounded-[12px] text-sm font-dm"
          />
          <p className="text-[11px] text-cream/30 font-dm mt-1.5">
            A resposta vai para este endereço. Se possível, use o mesmo da sua
            conta.
          </p>
        </div>

        <div>
          <label
            htmlFor="oc-whatsapp"
            className="block text-[12px] font-medium text-cream/50 font-dm mb-1.5"
          >
            WhatsApp{" "}
            <span className="text-cream/25 font-normal">(opcional)</span>
          </label>
          <input
            id="oc-whatsapp"
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            className="w-full px-4 py-3 dark-input rounded-[12px] text-sm font-dm"
          />
        </div>

        <div>
          <label
            htmlFor="oc-relato"
            className="block text-[12px] font-medium text-cream/50 font-dm mb-1.5"
          >
            O que aconteceu
          </label>
          <textarea
            id="oc-relato"
            required
            rows={6}
            value={relato}
            onChange={(e) => setRelato(e.target.value)}
            placeholder="Descreva com suas palavras: o que você fez, como acompanhou o conteúdo, se houve algum problema técnico, e o que mais achar importante para quem for analisar."
            className="w-full px-4 py-3 dark-input rounded-[12px] text-sm font-dm resize-none"
          />
          <p className="text-[11px] text-cream/30 font-dm mt-1.5">
            {relato.trim().length < MIN_RELATO
              ? `Mínimo de ${MIN_RELATO} caracteres (${relato.trim().length} até agora).`
              : "Pode detalhar à vontade."}
          </p>
        </div>

        {/* Honeypot. Fica fora da tela e fora da navegação por teclado para não
            aparecer para leitor de tela nem para quem usa Tab. */}
        <div aria-hidden="true" className="absolute -left-[9999px] opacity-0">
          <label htmlFor="website">Não preencha este campo</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {erro && (
          <div
            className="rounded-[12px] px-4 py-3"
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.18)",
            }}
          >
            <p className="text-[13px] text-red-200/80 font-dm">{erro}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!podeEnviar}
          className="w-full px-4 py-3 rounded-[10px] text-sm font-medium text-cream disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{
            background: "linear-gradient(135deg, #C84B31, #A33D27)",
            boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
          }}
        >
          {enviando ? "Enviando..." : "Enviar manifestação"}
        </button>

        <p className="text-[11px] text-cream/25 font-dm text-center leading-relaxed">
          Ao enviar, você concorda com o tratamento destes dados para a análise
          do caso, conforme os{" "}
          <Link href="/formacao/termos" className="text-accent hover:underline">
            Termos de Uso
          </Link>
          .
        </p>
      </form>
    </motion.div>
  );
}

export default function OcorrenciaPage() {
  return (
    <div className="min-h-screen" style={{ background: "#111111" }}>
      {/* Suspense é exigência do Next 14 para useSearchParams em client
          component: sem ele o build falha na pré-renderização da rota. */}
      <Suspense
        fallback={
          <div className="max-w-xl mx-auto px-6 py-16">
            <div className="h-64 rounded-[16px] animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
          </div>
        }
      >
        <OcorrenciaForm />
      </Suspense>
    </div>
  );
}
