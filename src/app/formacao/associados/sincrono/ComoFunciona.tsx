"use client";

// O combinado com quem conduz.
//
// O mesmo conteúdo hoje é dito no WhatsApp, uma vez, no começo — e some no
// meio da conversa quando a pessoa precisa dele três semanas depois. Aqui ele
// fica no lugar onde ela trabalha.
//
// Vem fechado de propósito: quem já leu não precisa passar por ele toda vez, e
// quem nunca leu vê o título e abre. Um bloco de texto aberto no topo de uma
// tela de trabalho é um bloco que se aprende a pular.

import { useState } from "react";
import Card from "@/components/ui/Card";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";

const DESCRICAO_DO_GRUPO = `🎥 Encontros gravados:
allos.org.br/formacao

🧠 Quer fazer psicoterapia?
[seu link de associado]

📚 Quer participar de um processo seletivo de estágio clínico com supervisão e feedback?
allos.org.br/processoseletivopsi

🔗 Conheça outros grupos da Associação Allos:
https://chat.whatsapp.com/KP2z0vFRaSVBSXRjIyvR3R`;

export default function ComoFunciona({
  // Fechado quando divide a tela com o trabalho, aberto quando é a tela
  // inteira: numa aba própria, exigir mais um clique para ler é gratuito.
  inicialmenteAberto = false,
}: {
  inicialmenteAberto?: boolean;
}) {
  const [aberto, setAberto] = useState(inicialmenteAberto);

  return (
    <Card className="p-4">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center gap-2 text-left py-2 min-h-[44px] md:py-0 md:min-h-0"
      >
        {aberto ? (
          <ChevronDown className="h-4 w-4 text-cream/40 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-cream/40 shrink-0" />
        )}
        <span className="text-sm text-cream font-semibold flex-1 min-w-0">
          Como funciona o seu grupo
        </span>
        {/* No celular a dica curta some: junto com o título ela estoura os 360px. */}
        <span className="hidden sm:inline text-xs text-cream/30 ml-auto">
          {aberto ? "fechar" : "o combinado, em um minuto"}
        </span>
      </button>

      {aberto && (
        <div className="mt-4 space-y-5 text-sm text-cream/60 leading-relaxed">
          <div>
            <p className="text-cream/80 font-semibold mb-1.5">O grupo é seu, não da Allos.</p>
            <p>
              A Allos entra como plataforma: divulga a programação, hospeda as gravações no site e
              emite os certificados. A condução, o conteúdo e a divulgação são seus.
            </p>
          </div>

          <div>
            <p className="text-cream/80 font-semibold mb-1.5">Na prática</p>
            <p>
              Crie um grupo de WhatsApp do seu grupo de estudos. Quando os encontros começarem,
              poste na categoria base da Allos o link do Meet e o link do seu grupo, e mande o link
              do Meet também dentro do seu próprio grupo. Quando os encontros terminarem, o seu
              grupo é acoplado à categoria base e qualquer associado passa a conseguir entrar.
            </p>
          </div>

          <div>
            <p className="text-cream/80 font-semibold mb-1.5">Divulgação</p>
            <p>
              É o que mais decide se o grupo enche. Vale passar em salas da sua faculdade, mandar em
              grupos de colegas, postar no seu Instagram. A arte do grupo a Allos providencia, e ela
              ajuda a circular.
            </p>
          </div>

          <div>
            <p className="text-cream/80 font-semibold mb-1.5">Um link só, sempre o mesmo</p>
            <p>
              O endereço do Meet do seu grupo não muda de uma semana para a outra. Ele está na aba
              Meu encontro, e é por ele que a sala reconhece de quem é aquele horário, o que poupa
              você de configurar qualquer coisa antes de começar. Abrindo uma reunião por fora, o
              encontro acontece normalmente, só que fica solto: não é registrado, não vira aula e
              não rende nada depois.
            </p>
          </div>

          <div>
            <p className="text-cream/80 font-semibold mb-1.5">O que acontece sozinho</p>
            <p>
              Entrando por esse link, o registro do encontro começa junto com ele. A gravação, a
              transcrição e as notas de IA ficam ligadas por padrão, e você não precisa apertar nada
              enquanto conduz. Se em algum dia fizer sentido não registrar, os botões da aba Meu
              encontro desligam qualquer uma das três.
            </p>
            <p className="mt-2">
              Terminado o encontro, o vídeo sobe para o YouTube como não listado, que é o modo em
              que só abre quem tem o endereço: ele não aparece em busca, nem no canal, nem para
              quem não recebeu o link. De lá ele chega ao site da Allos, na página do seu grupo, que
              é o que permite alguém rever um encontro perdido e o que sustenta o certificado no
              fim.
            </p>
          </div>

          <div>
            <p className="text-cream/80 font-semibold mb-1.5">Os cortes passam por você</p>
            <p>
              Do vídeo inteiro saem trechos curtos, e eles aparecem na aba Cortes esperando a sua
              opinião. Nada sai dali por conta própria: o que presta você aprova, o que não presta
              você recusa, e o campo de anotação existe para registrar o motivo quando valer a pena
              lembrar dele depois.
            </p>
            <p className="mt-2">
              O que você aprovar fica à sua disposição para o seu Instagram, se for do seu
              interesse. Dá para publicar em parceria com o perfil da Allos Formação, o que coloca o
              vídeo também na frente de quem acompanha a página e costuma alcançar mais gente do que
              o seu perfil sozinho. Como isso vale para todo encontro, quem conduz por um semestre
              termina com material recorrente sem ter parado para gravar nada além das próprias
              aulas.
            </p>
          </div>

          <div>
            <p className="text-cream/80 font-semibold mb-1.5">Seu link de associado</p>
            <p>
              Serve para juntar uma lista de espera de pacientes para quando você sair daqui. Monta
              em{" "}
              <a
                href="https://allos.org.br/painel"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline decoration-accent/30"
              >
                allos.org.br/painel
              </a>
              .
            </p>
          </div>

          <div>
            <p className="text-cream/80 font-semibold mb-1.5">Nome do grupo</p>
            <p>
              Pense num título que caiba num certificado depois: que deixe claro que é psicologia,
              ou o tema específico. Evite o metafórico e o vago, porque quem lê o certificado não
              esteve no grupo.
            </p>
          </div>

          <div>
            <p className="text-cream/80 font-semibold mb-1.5">
              Descrição do grupo de WhatsApp
            </p>
            <p className="mb-2">
              É o que reconecta o seu grupo à Allos e abre porta para quem chega. Copie, cole e
              troque pelo seu link de associado.
            </p>
            <div
              className="rounded-xl p-3 relative"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <pre className="text-xs text-cream/50 whitespace-pre-wrap font-dm leading-relaxed">
                {DESCRICAO_DO_GRUPO}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(DESCRICAO_DO_GRUPO);
                  toast.success("Descrição copiada.");
                }}
                className="absolute top-2 right-2 flex items-center justify-center h-10 w-10 md:h-auto md:w-auto md:p-1.5 rounded-lg text-cream/40 hover:text-cream/70"
                style={{ background: "rgba(255,255,255,0.05)" }}
                title="Copiar"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
