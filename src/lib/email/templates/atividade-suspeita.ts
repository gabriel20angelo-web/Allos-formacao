// E-mail de notificação de atividade atípica.
//
// Modular por construção: o corpo é montado a partir dos sinais detectados,
// um bloco por ocorrência, com os números que a plataforma registrou. Nada é
// escrito à mão na hora do envio — o que aparece no e-mail é o mesmo que está
// no dossiê, o que evita a acusação errada e evita o texto genérico que não
// diz nada.
//
// Sobre o tom: firmeza vem de dado verificável e de consequência real, não de
// adjetivo nem de ameaça penal. O que faz efeito aqui é a pessoa entender três
// coisas: que existe registro do que ela fez, que a Allos responde pela
// declaração de carga horária que assina, e que um certificado anulado é
// comunicado à instituição que o recebeu. Isso é verdadeiro, está nos Termos
// que ela aceitou, e não expõe a Allos a acusação de constrangimento.
//
// Dois níveis:
//   "aviso"        — primeira comunicação, abre conversa e pede explicação
//   "notificacao"  — formal, com prazo de 7 dias da cláusula 8.5

import type { Sinal } from "@/lib/utils/suspeita";

export type NivelEmail = "aviso" | "notificacao";

export interface DadosPessoa {
  nome: string;
  email: string;
  /** Nomes diferentes usados no formulário de certificação. */
  aliases?: string[];
  feedbacks: number;
  horasSincronas: number;
  cursosConcluidos: number;
  certificados: number;
  aulasConcluidas: number;
  tempoUsoSegundos: number;
}

export interface EmailMontado {
  assunto: string;
  texto: string;
  html: string;
}

const CONTATO = "suporte@allos.org.br";

// A resposta vai para uma página do site, não para a caixa de entrada: chega
// estruturada, fica junto do caso no painel, e funciona para quem está com o
// acesso bloqueado e não consegue entrar na plataforma.
const BASE =
  process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://allos.org.br";
const URL_OCORRENCIA = BASE + "/formacao/ocorrencia?origem=aviso";

function dataPtBR(dia: string): string {
  const [y, m, d] = dia.split("-");
  return `${d}/${m}/${y}`;
}

function duracao(segundos: number): string {
  if (!segundos) return "nenhum tempo registrado";
  const h = Math.floor(segundos / 3600);
  const min = Math.round((segundos % 3600) / 60);
  if (h > 0) return `${h}h${min > 0 ? ` ${min}min` : ""}`;
  return `${min}min`;
}

/** Uma frase por tipo de sinal, explicando o que a plataforma viu. */
function descreverSinal(s: Sinal): { titulo: string; corpo: string } {
  switch (s.tipo) {
    case "feedback-rajada":
      return {
        titulo: `${dataPtBR(s.dia)} — ${s.titulo}`,
        corpo:
          `${s.detalhe} Cada formulário enviado soma carga horária ao seu ` +
          `certificado, e o intervalo entre eles é incompatível com a ` +
          `participação nas atividades declaradas.`,
      };
    case "aula-rajada":
      return {
        titulo: `${dataPtBR(s.dia)} — ${s.titulo}`,
        corpo:
          `${s.detalhe} O registro mostra as aulas sendo marcadas como ` +
          `concluídas em sequência, em intervalo menor que a duração dos ` +
          `próprios vídeos.`,
      };
    case "conclusao-no-mesmo-dia":
      return {
        titulo: `${dataPtBR(s.dia)} — ${s.titulo}`,
        corpo: `${s.detalhe} A matrícula e a conclusão constam do mesmo dia.`,
      };
  }
}

function blocoDados(p: DadosPessoa): string[] {
  const linhas = [
    `Conta: ${p.email}`,
    `Formulários de certificação enviados: ${p.feedbacks}`,
    `Carga horária síncrona já declarada: ${p.horasSincronas} horas`,
    `Tempo de permanência registrado na plataforma: ${duracao(p.tempoUsoSegundos)}`,
    `Aulas marcadas como concluídas: ${p.aulasConcluidas}`,
    `Cursos concluídos: ${p.cursosConcluidos}`,
    `Certificados emitidos: ${p.certificados}`,
  ];
  if (p.aliases && p.aliases.length > 0) {
    linhas.push(
      `Nomes usados no formulário: ${[p.nome, ...p.aliases].join(", ")}`
    );
  }
  return linhas;
}

export function montarEmailSuspeita(
  pessoa: DadosPessoa,
  sinais: Sinal[],
  nivel: NivelEmail = "aviso"
): EmailMontado {
  const primeiroNome = pessoa.nome.trim().split(/\s+/)[0];
  const ocorrencias = sinais.map(descreverSinal);
  const dados = blocoDados(pessoa);

  const assunto =
    nivel === "notificacao"
      ? "Notificação: verificação de registros da sua conta na Allos"
      : "Sobre registros atípicos na sua conta da Formação Allos";

  const abertura =
    nivel === "notificacao"
      ? `${primeiroNome}, esta é uma comunicação formal sobre os registros da sua conta na plataforma de formação da Associação Allos.`
      : `${primeiroNome}, tudo bem? Estamos entrando em contato sobre alguns registros da sua conta na plataforma de formação da Allos.`;

  const contexto =
    `A plataforma mantém registro de acesso, progresso e tempo de permanência ` +
    `em cada aula, conforme a cláusula 8.4 dos Termos de Uso que você aceitou ` +
    `ao criar a conta. Esses registros são auditados antes da emissão de ` +
    `certificados, porque quem assina a declaração de carga horária é a Allos, ` +
    `e é a Allos que responde por ela perante quem recebe o documento.`;

  const oQueVimos =
    ocorrencias.length === 1
      ? "Ao revisar sua conta, encontramos o seguinte:"
      : `Ao revisar sua conta, encontramos ${ocorrencias.length} ocorrências:`;

  const consequencia =
    `Certificado emitido a partir de registro inconsistente pode ser anulado, ` +
    `conforme a cláusula 8.6. A anulação passa a constar no verificador ` +
    `público de autenticidade e, quando o documento já tiver sido apresentado ` +
    `a instituição de ensino, empregador ou conselho de classe, a Allos pode ` +
    `comunicar a anulação diretamente a esse destinatário, nos termos da ` +
    `cláusula 8.8, que você aceitou. As providências que a instituição venha ` +
    `a tomar a partir daí não dependem de nós.`;

  const boaFe =
    `O uso da plataforma está sujeito ao dever de boa-fé objetiva previsto no ` +
    `art. 422 do Código Civil, e o tratamento desses registros se apoia no ` +
    `art. 7º, incisos V e IX, da Lei nº 13.709/2018.`;

  const prazo =
    nivel === "notificacao"
      ? `Você tem 7 (sete) dias corridos, contados do recebimento desta mensagem, para se manifestar, conforme a cláusula 8.5. Recebida a manifestação, respondemos em até 5 (cinco) dias úteis.`
      : `Se houver explicação, queremos ouvi-la antes de qualquer decisão. Use a página abaixo para contar o que aconteceu.`;

  const saida =
    `Se os registros não refletem o que você de fato fez, é possível que tenha ` +
    `havido falha técnica, e isso se resolve. Se refletem, o caminho mais ` +
    `simples é acompanhar o conteúdo: o acesso continua liberado e a formação ` +
    `é gratuita. Nenhuma das duas situações precisa terminar mal.`;

  const comoResponder =
    `Para se manifestar, preencha o formulário em ${URL_OCORRENCIA} . ` +
    `Não responda este e-mail: pela página a sua explicação chega direto a ` +
    `quem analisa o caso, junto com o histórico da sua conta.`;

  const assinatura = `Associação Allos\nFormação\n${CONTATO}`;

  // ── Texto puro ──
  const texto = [
    abertura,
    "",
    contexto,
    "",
    oQueVimos,
    "",
    ...ocorrencias.map((o) => `• ${o.titulo}\n  ${o.corpo}`),
    "",
    "Registros da sua conta:",
    ...dados.map((d) => `  ${d}`),
    "",
    consequencia,
    "",
    boaFe,
    "",
    prazo,
    "",
    comoResponder,
    "",
    saida,
    "",
    "---",
    assinatura,
  ].join("\n");

  // ── HTML ──
  const p = (t: string) =>
    `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#2f2f2f">${t}</p>`;

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f5f4f2;font-family:Georgia,'Times New Roman',serif">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e6e2dc;border-radius:10px;padding:32px">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a33d27">Associação Allos</p>
    <h1 style="margin:0 0 20px;font-size:19px;line-height:1.3;color:#1f1f1f;font-weight:700">${
      nivel === "notificacao"
        ? "Verificação de registros da sua conta"
        : "Registros atípicos na sua conta"
    }</h1>

    ${p(abertura)}
    ${p(contexto)}
    ${p(`<strong>${oQueVimos}</strong>`)}

    ${ocorrencias
      .map(
        (o) => `<div style="margin:0 0 12px;padding:12px 14px;background:#fdf6ec;border-left:3px solid #d99b28;border-radius:4px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#8a5a10">${o.titulo}</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#4a4a4a">${o.corpo}</p>
    </div>`
      )
      .join("\n")}

    <div style="margin:18px 0;padding:14px 16px;background:#faf9f7;border:1px solid #eceae5;border-radius:6px">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b6b6b;text-transform:uppercase;letter-spacing:.06em">Registros da sua conta</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#3a3a3a">
        ${dados
          .map((d) => {
            const [rotulo, ...resto] = d.split(":");
            return `<tr><td style="padding:3px 0;color:#6b6b6b">${rotulo}</td><td style="padding:3px 0;text-align:right;font-weight:600">${resto.join(":").trim()}</td></tr>`;
          })
          .join("")}
      </table>
    </div>

    ${p(consequencia)}
    ${p(`<span style="color:#5a5a5a;font-size:13px">${boaFe}</span>`)}
    ${p(`<strong>${prazo}</strong>`)}

    <p style="margin:0 0 16px">
      <a href="${URL_OCORRENCIA}" style="display:inline-block;background:#a33d27;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:700">Explicar o que aconteceu</a>
    </p>
    ${p(`<span style="font-size:13px;color:#5a5a5a">Não responda este e-mail: pela página a sua explicação chega direto a quem analisa o caso.</span>`)}
    ${p(saida)}

    <hr style="border:none;border-top:1px solid #e6e2dc;margin:24px 0 16px">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8a8a">
      Associação Allos &middot; Formação<br>
      <a href="mailto:${CONTATO}" style="color:#a33d27;text-decoration:none">${CONTATO}</a>
    </p>
  </div>
</body></html>`;

  return { assunto, texto, html };
}
