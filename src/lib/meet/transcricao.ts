// Transcrição legível: de legenda para texto que dá para ler.
//
// O OpusClip entrega dois arquivos, e o mais óbvio é o pior. O .txt vem como um
// paredão: 67 mil caracteres do primeiro encontro da Alice, zero quebras de
// linha e 633 pontos finais sem espaço depois ("mas pouco sentir, poucoÉ, e as
// críticas do behaviorismo"). Serve para uma máquina procurar palavra; não
// serve para alguém ler, e muito menos para virar livro.
//
// O .srt tem a mesma fala partida em blocos, cada um com início e fim. Com o
// tempo dá para reconstruir o que a fala tinha e a transcrição perdeu: onde
// termina um assunto e começa outro. É disso que este arquivo trata.
//
// A transcrição do Meet é outra história: ela sabe QUEM falou. Quando existe,
// ganha da do OpusClip, porque num grupo de formação saber quem disse o quê é
// metade do valor do texto.

export interface BlocoFala {
  inicioSeg: number;
  fimSeg: number;
  texto: string;
  /** Só a transcrição do Meet sabe. */
  quem?: string;
}

/** Pausa a partir da qual se assume que virou outro assunto. */
const PAUSA_PARAGRAFO = 2.0;

/** De quanto em quanto tempo marcar a posição no texto. */
const MARCA_MIN = 5;

function tempoParaSegundos(t: string): number {
  // 00:01:23,456
  const m = t.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

export function formatarTempo(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.floor(seg % 60);
  const doisDigitos = (n: number) => String(n).padStart(2, "0");
  return h > 0
    ? `${h}:${doisDigitos(m)}:${doisDigitos(s)}`
    : `${m}:${doisDigitos(s)}`;
}

/** Lê um arquivo .srt e devolve os blocos na ordem. */
export function lerSrt(srt: string): BlocoFala[] {
  const blocos: BlocoFala[] = [];
  // Separa por linha em branco; aceita \r\n e \n para não depender de quem gerou.
  for (const pedaco of srt.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const linhas = pedaco.split("\n").filter((l) => l.trim());
    if (linhas.length < 2) continue;

    const linhaTempo = linhas.find((l) => l.includes("-->"));
    if (!linhaTempo) continue;

    const [de, ate] = linhaTempo.split("-->").map((s) => s.trim());
    const texto = linhas
      .slice(linhas.indexOf(linhaTempo) + 1)
      .join(" ")
      .trim();
    if (!texto) continue;

    blocos.push({
      inicioSeg: tempoParaSegundos(de),
      fimSeg: tempoParaSegundos(ate),
      texto,
    });
  }
  return blocos;
}

export interface OpcoesTexto {
  titulo?: string;
  /** Linha de contexto abaixo do título: data, curso, de onde veio. */
  subtitulo?: string;
  /** Marcar a posição no vídeo de tempos em tempos. */
  comTempos?: boolean;
}

/**
 * Transforma blocos em texto com parágrafos.
 *
 * O corte de parágrafo sai da pausa entre blocos, não de contagem de palavras:
 * quem fala pausa quando muda de assunto, e essa pausa está no arquivo. É a
 * única pontuação estrutural que a transcrição preserva de graça.
 *
 * Quando há mudança de falante, ela vence a pausa — trocar de pessoa é sempre
 * parágrafo novo.
 */
export function blocosParaTexto(blocos: BlocoFala[], opcoes: OpcoesTexto = {}): string {
  if (!blocos.length) return "";

  const linhas: string[] = [];
  if (opcoes.titulo) linhas.push(`# ${opcoes.titulo}`, "");
  if (opcoes.subtitulo) linhas.push(`*${opcoes.subtitulo}*`, "");

  let paragrafo: string[] = [];
  let quemAtual: string | undefined;
  let inicioDoParagrafo = blocos[0].inicioSeg;
  let proximaMarca = MARCA_MIN * 60;

  const fecharParagrafo = () => {
    if (!paragrafo.length) return;
    const corpo = juntarFrases(paragrafo);
    const marca = opcoes.comTempos ? `\`${formatarTempo(inicioDoParagrafo)}\` ` : "";
    const nome = quemAtual ? `**${quemAtual}:** ` : "";
    linhas.push(`${marca}${nome}${corpo}`, "");
    paragrafo = [];
  };

  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    const anterior = blocos[i - 1];

    const trocouFalante = b.quem !== undefined && b.quem !== quemAtual;
    const pausou = anterior ? b.inicioSeg - anterior.fimSeg >= PAUSA_PARAGRAFO : false;

    if (paragrafo.length && (trocouFalante || pausou)) {
      fecharParagrafo();
      inicioDoParagrafo = b.inicioSeg;
    }

    // Marca de tempo periódica, para achar o trecho no vídeo depois. Só entra
    // em quebra de parágrafo, senão picota o texto no meio de uma frase.
    if (opcoes.comTempos && !paragrafo.length && b.inicioSeg >= proximaMarca) {
      while (proximaMarca <= b.inicioSeg) proximaMarca += MARCA_MIN * 60;
    }

    if (trocouFalante) quemAtual = b.quem;
    if (b.quem !== undefined && quemAtual === undefined) quemAtual = b.quem;

    paragrafo.push(b.texto);
  }
  fecharParagrafo();

  return linhas.join("\n").trim() + "\n";
}

/**
 * Junta as frases de um parágrafo cuidando do espaço que a transcrição comeu.
 *
 * Cada bloco de legenda costuma terminar em ponto, e emendar sem espaço produz
 * "poucoÉ, e as críticas" — que foi exatamente o que o .txt entregou.
 */
function juntarFrases(frases: string[]): string {
  return frases
    .map((f) => f.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    // Rede para o caso de o texto já vir emendado da origem.
    .replace(/([.!?])([A-ZÀ-ÚÂ-Û])/g, "$1 $2")
    .trim();
}

/**
 * Conserta texto corrido que veio sem respiro.
 *
 * Usado só quando não há .srt — sem os tempos não dá para saber onde estava a
 * pausa, então o melhor possível é separar as frases e agrupar de tantas em
 * tantas. Fica pior que o caminho do .srt, e é por isso que ele é o preferido.
 */
export function limparTextoCorrido(texto: string, frasesPorParagrafo = 5): string {
  const comEspaco = texto
    .replace(/([.!?])([A-ZÀ-ÚÂ-Û])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  const frases = comEspaco.match(/[^.!?]+[.!?]*/g) || [comEspaco];
  const paragrafos: string[] = [];
  for (let i = 0; i < frases.length; i += frasesPorParagrafo) {
    paragrafos.push(
      frases
        .slice(i, i + frasesPorParagrafo)
        .map((f) => f.trim())
        .join(" ")
    );
  }
  return paragrafos.join("\n\n") + "\n";
}

/** Falas do Meet, que sabem quem falou, no mesmo formato dos blocos. */
export function falasParaBlocos(
  falas: { display_name: string; texto: string; inicio: string | null; fim: string | null }[]
): BlocoFala[] {
  if (!falas.length) return [];
  const zero = falas[0].inicio ? new Date(falas[0].inicio).getTime() : 0;
  return falas.map((f) => ({
    // Relativo ao começo do encontro: hora de parede não ajuda quem quer achar
    // o trecho no vídeo.
    inicioSeg: f.inicio ? (new Date(f.inicio).getTime() - zero) / 1000 : 0,
    fimSeg: f.fim ? (new Date(f.fim).getTime() - zero) / 1000 : 0,
    texto: f.texto,
    quem: f.display_name || undefined,
  }));
}
