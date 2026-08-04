// Quem avisa que a máquina parou.
//
// A automação do Meet roda a cada 15 minutos e é a única coisa que capta
// presença, abre e fecha sala, arquiva gravação e fecha a semana. Até aqui ela
// falhava em silêncio: o serviço que a dispara usa curl sem `--fail`, então a
// execução aparecia verde mesmo com a rota devolvendo erro, e o único sinal de
// que algo tinha parado era a data da última busca no painel, que só quem
// abrisse a tela veria.
//
// São dois problemas diferentes e eles pedem vigias diferentes:
//
//   1. A rodada rodou e alguma etapa quebrou. Quem percebe é a própria rodada,
//      no fim dela (`avisarSeRodadaFalhou`).
//   2. A rodada não rodou. Nenhum código dentro do cron pode perceber isso,
//      porque ele também não rodou. Por isso existe um vigia separado, com o
//      próprio agendamento, que só olha a idade do último registro
//      (`avisarSeCapturaSumiu`).
//
// Nos dois casos o e-mail passa pela mesma folga: um assunto só volta a doer
// depois de FOLGA_HORAS, senão vira quatro e-mails por hora e ninguém lê mais
// nenhum.

import { sendMail, workspaceConfigurado } from "@/lib/email/googleWorkspace";

type Sb = {
  from: (t: string) => {
    select: (c: string) => {
      order: (c: string, o: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
      };
      eq: (c: string, v: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
    upsert: (v: Record<string, unknown>, o?: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
};

const FOLGA_HORAS = 6;

// A captura roda de 15 em 15 minutos. Uma hora e meia de silêncio já é muito
// mais do que qualquer rodada demorada explica, e ainda dá margem para uma
// janela de deploy sem gerar susto.
const SILENCIO_QUE_PREOCUPA_MIN = 90;

const PARA = process.env.AVISOS_EMAIL || process.env.GOOGLE_IMPERSONATED_USER || "";

function agora() {
  return new Date();
}

/** True quando o assunto já pode doer de novo. */
async function podeAvisar(sb: Sb, chave: string): Promise<boolean> {
  try {
    const { data } = await sb
      .from("avisos_watermarks")
      .select("ultimo_email")
      .eq("chave", chave)
      .maybeSingle();

    const ultimo = (data as { ultimo_email?: string } | null)?.ultimo_email;
    if (!ultimo) return true;

    const horas = (agora().getTime() - new Date(ultimo).getTime()) / 3_600_000;
    return horas >= FOLGA_HORAS;
  } catch {
    // Falha ao ler a folga não pode calar o alarme: na dúvida, avisa.
    return true;
  }
}

async function registrar(sb: Sb, chave: string, texto: string) {
  await sb
    .from("avisos_watermarks")
    .upsert(
      { chave, ultimo_email: agora().toISOString(), ultimo_texto: texto.slice(0, 500), atualizado_em: agora().toISOString() },
      { onConflict: "chave" }
    );
}

async function enviar(assunto: string, linhas: string[]): Promise<boolean> {
  if (!workspaceConfigurado() || !PARA) return false;

  const texto = linhas.join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111">${linhas
    .map((l) => (l ? `<p style="margin:0 0 10px">${l}</p>` : ""))
    .join("")}</div>`;

  await sendMail({ para: PARA, assunto, texto, html });
  return true;
}

/**
 * Chamado no fim de cada rodada do cron. Só dói quando alguma etapa quebrou.
 * Nunca lança: um alarme que derruba a rodada seria pior que o problema que
 * ele denuncia.
 */
export async function avisarSeRodadaFalhou(
  sb: Sb,
  erros: string[]
): Promise<{ avisou: boolean; motivo?: string }> {
  try {
    if (erros.length === 0) return { avisou: false };
    if (!(await podeAvisar(sb, "captura"))) return { avisou: false, motivo: "dentro da folga" };

    const enviou = await enviar(
      `Allos: a captura do Meet terminou com ${erros.length} erro(s)`,
      [
        `A rodada da automação do Meet rodou, mas ${erros.length === 1 ? "uma etapa não completou" : `${erros.length} etapas não completaram`}.`,
        "",
        ...erros.map((e) => `• ${e}`),
        "",
        "As outras etapas seguiram normalmente, e a próxima rodada tenta de novo em 15 minutos. Se a mesma etapa aparecer aqui várias vezes, vale abrir o painel do Meet, aba Ajustes.",
        "",
        `Este aviso não se repete nas próximas ${FOLGA_HORAS} horas.`,
      ]
    );

    if (enviou) await registrar(sb, "captura", erros.join(" | "));
    return { avisou: enviou, motivo: enviou ? undefined : "e-mail não configurado" };
  } catch (e) {
    return { avisou: false, motivo: e instanceof Error ? e.message : "erro ao avisar" };
  }
}

/**
 * Manda um e-mail de mentira, para provar que o caminho do alarme está de pé.
 *
 * Alarme que ninguém nunca viu funcionar é pior do que alarme nenhum: dá a
 * sensação de estar coberto. Isto existe para responder "o e-mail sai mesmo?"
 * sem precisar esperar a máquina quebrar de verdade. Ignora a folga de
 * propósito, e não grava marca nenhuma, para não calar um alarme real logo
 * depois do teste.
 */
export async function avisarDeMentira(): Promise<{ enviou: boolean; para: string; motivo?: string }> {
  try {
    const enviou = await enviar("Allos: teste do alarme da captura", [
      "Este é um teste, disparado de propósito. Nada está errado.",
      "",
      "Serve para provar que o caminho do alarme funciona: se um dia a captura do Meet parar ou uma etapa quebrar, um e-mail como este vai chegar neste endereço.",
      "",
      "Se você recebeu isto sem ter pedido, alguém chamou o endereço de teste do vigia.",
    ]);
    return { enviou, para: PARA, motivo: enviou ? undefined : "Workspace não configurado ou destinatário vazio" };
  } catch (e) {
    return { enviou: false, para: PARA, motivo: e instanceof Error ? e.message : "erro ao enviar" };
  }
}

/**
 * Chamado pelo vigia, que tem agendamento próprio. Olha só a idade do último
 * registro de captura: se a automação parou, é isto que percebe, porque quem
 * parou não consegue reclamar de si mesmo.
 */
export async function avisarSeCapturaSumiu(
  sb: Sb
): Promise<{ saudavel: boolean; minutos: number | null; avisou: boolean; motivo?: string }> {
  let minutos: number | null = null;

  try {
    const { data } = await sb
      .from("formacao_meet_ingest_logs")
      .select("executado_em,erro")
      .order("executado_em", { ascending: false })
      .limit(1);

    const ultima = (data as { executado_em?: string }[] | null)?.[0];
    if (ultima?.executado_em) {
      minutos = Math.round((agora().getTime() - new Date(ultima.executado_em).getTime()) / 60_000);
    }

    const saudavel = minutos !== null && minutos <= SILENCIO_QUE_PREOCUPA_MIN;
    if (saudavel) return { saudavel, minutos, avisou: false };

    if (!(await podeAvisar(sb, "captura-parada"))) {
      return { saudavel, minutos, avisou: false, motivo: "dentro da folga" };
    }

    const quanto =
      minutos === null
        ? "não existe registro nenhum de captura"
        : `a última captura foi há ${minutos >= 120 ? `${Math.round(minutos / 60)} horas` : `${minutos} minutos`}`;

    const enviou = await enviar("Allos: a captura do Meet parou", [
      `A automação do Meet deveria rodar a cada 15 minutos, e ${quanto}.`,
      "",
      "Enquanto ela está parada, nada disso acontece: presença dos encontros não é capturada, a sala não abre nem fecha no horário, reunião esquecida não é encerrada, gravação não vai para o Drive e a semana não fecha na segunda.",
      "",
      "O que conferir, nesta ordem: se o serviço captura-meet-cron da Railway ainda existe e está com o agendamento ligado; se a aplicação está no ar; e a aba Ajustes do painel do Meet, que mostra a idade da última busca.",
      "",
      `Este aviso não se repete nas próximas ${FOLGA_HORAS} horas.`,
    ]);

    if (enviou) await registrar(sb, "captura-parada", quanto);
    return { saudavel, minutos, avisou: enviou, motivo: enviou ? undefined : "e-mail não configurado" };
  } catch (e) {
    return { saudavel: false, minutos, avisou: false, motivo: e instanceof Error ? e.message : "erro ao vigiar" };
  }
}
