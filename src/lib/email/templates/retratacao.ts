// E-mail de retratação: o aviso anterior foi enviado por engano.
//
// Escrito com três cuidados, nessa ordem de importância:
//
// 1. Não repete a acusação. Nem para negá-la. Reafirmar "não estamos dizendo
//    que você fraudou" planta a ideia de novo na cabeça de quem lê e mantém a
//    palavra no histórico da caixa de entrada.
// 2. Assume o erro sem terceirizar. Nada de "o sistema identificou": quem
//    enviou foi a Allos, e é a Allos que se retrata.
// 3. Não pede nada em troca. Sem formulário, sem prazo, sem "caso queira
//    esclarecer". A pessoa não tem obrigação nenhuma aqui, e sugerir que tem
//    manteria a suspeita viva.
//
// Curto de propósito: retratação longa parece justificativa.

export interface EmailRetratacao {
  assunto: string;
  texto: string;
  html: string;
}

const CONTATO = "suporte@allos.org.br";

export function montarEmailRetratacao(nome: string): EmailRetratacao {
  const primeiroNome = (nome || "").trim().split(/\s+/)[0] || "Olá";

  const assunto = "Desconsidere nossa mensagem anterior";

  const p1 = `${primeiroNome}, o e-mail que enviamos a você hoje sobre registros da sua conta foi disparado por engano, em uma revisão interna nossa que não deveria ter gerado comunicação a ninguém.`;

  const p2 =
    `A mensagem não procede e não há nenhuma pendência ou restrição associada ` +
    `à sua conta. Pode desconsiderá-la por completo: seu acesso, seu histórico ` +
    `e seus certificados seguem exatamente como estavam.`;

  const p3 =
    `O erro foi nosso e pedimos desculpas pelo incômodo e pelo susto. ` +
    `Já corrigimos o que permitiu o envio.`;

  const p4 = `Se ficou alguma dúvida, é só responder para ${CONTATO} e falamos direto com você.`;

  const assinatura = `Associação Allos\nFormação\n${CONTATO}`;

  const texto = [p1, "", p2, "", p3, "", p4, "", "---", assinatura].join("\n");

  const par = (t: string) =>
    `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#2f2f2f">${t}</p>`;

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f5f4f2;font-family:Georgia,'Times New Roman',serif">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e6e2dc;border-radius:10px;padding:32px">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a33d27">Associação Allos</p>
    <h1 style="margin:0 0 20px;font-size:19px;line-height:1.3;color:#1f1f1f;font-weight:700">Desconsidere nossa mensagem anterior</h1>
    ${par(p1)}
    ${par(`<strong>${p2}</strong>`)}
    ${par(p3)}
    ${par(p4)}
    <hr style="border:none;border-top:1px solid #e6e2dc;margin:24px 0 16px">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8a8a">
      Associação Allos &middot; Formação<br>
      <a href="mailto:${CONTATO}" style="color:#a33d27;text-decoration:none">${CONTATO}</a>
    </p>
  </div>
</body></html>`;

  return { assunto, texto, html };
}
