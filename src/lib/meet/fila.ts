// Quem a varredura ainda precisa visitar, e em que ordem.
//
// Separado do resto da ingestão porque é a peça que já falhou duas vezes, das
// duas em silêncio: o encontro some da fila, nada dá erro, e o dado que faltava
// nunca chega. Aqui é função pura, com teste em `fila.test.ts`.

/** Prazo para o Google entregar o vídeo antes de a gente parar de esperar. */
export const HORAS_ESPERANDO_ARTEFATO = 48;

/** Quantas conferências uma sala processa por rodada. */
export const TETO_POR_RODADA = 8;

export interface EncontroConhecido {
  conference_record_id: string;
  inicio: string;
  fim: string | null;
  descartado: boolean | null;
  transcricao_ingerida: boolean | null;
  gravacao_uri: string | null;
}

/**
 * O encontro ainda tem trabalho pendente?
 *
 * Vale para duas coisas: puxar a janela de varredura para trás até alcançá-lo e
 * garantir-lhe vaga no teto da rodada. Errar aqui não gera erro nenhum, só um
 * encontro que nunca mais é tocado.
 */
export function aindaTemTrabalho(e: EncontroConhecido, agora = Date.now()): boolean {
  // Lixo não é pendência. Teste de link de dez segundos fica sem transcrição
  // por 48 horas porque o Google nunca gera uma, e nesse intervalo ele contava
  // como trabalho a fazer — chegou a ocupar o teto inteiro de uma sala.
  if (e.descartado) return false;

  if (!e.transcricao_ingerida) return true;

  // Falta só a gravação. O vídeo fica pronto depois do fim da reunião, às vezes
  // horas depois, e sem esta linha o encontro já ingerido saía da lista: a
  // janela voltava a começar no último encontro da sala e ele ficava fora do
  // alcance para sempre, com o vídeo existindo do lado do Google.
  if (e.gravacao_uri) return false;

  const fimEm = new Date(e.fim || e.inicio).getTime();
  if (Number.isNaN(fimEm)) return false;
  return (agora - fimEm) / 3_600_000 < HORAS_ESPERANDO_ARTEFATO;
}

interface ConferenciaOrdenavel {
  name: string;
  startTime: string;
}

/**
 * Ordena as conferências da sala pelo risco de ficarem sem outra chance.
 *
 * 1. pendente: é o único que não volta sozinho, então vai na frente
 * 2. desconhecida: entra pela primeira vez, da mais recente para a mais antiga
 * 3. descartada: lixo já classificado, atendido só se sobrar vaga
 *
 * O terceiro nível existe porque o teto é pequeno e o lixo é numeroso: numa
 * tarde de testes de link, oito conferências de dez segundos consumiam a rodada
 * inteira e o encontro de verdade esperava por uma vaga que nunca abria.
 */
export function ordenarPorUrgencia<T extends ConferenciaOrdenavel>(
  conferencias: T[],
  pendentes: Set<string>,
  descartados: Set<string>
): T[] {
  const nivel = (nome: string) =>
    pendentes.has(nome) ? 0 : descartados.has(nome) ? 2 : 1;

  return [...conferencias].sort((a, b) => {
    const na = nivel(a.name);
    const nb = nivel(b.name);
    if (na !== nb) return na - nb;
    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
  });
}
