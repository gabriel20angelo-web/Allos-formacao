// O índice mudou de casa: mora em /formacao/associados/aprimoramento, ao lado
// do Síncrono e dos Eventos, sob a navegação da área.
//
// A rota fica de pé porque o endereço antigo circulou por muito tempo — está
// salvo em favorito, colado em conversa de grupo e é o que a memória do
// navegador completa. Redirecionamento permanente, e não uma página com aviso:
// quem clica quer o acervo, não a notícia de que ele se mudou.
//
// As páginas profundas continuam aqui embaixo ([slug], categoria, tag,
// trilha). Só o índice saiu.

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function IndiceAntigoDoAprimoramento() {
  permanentRedirect("/formacao/associados/aprimoramento");
}
