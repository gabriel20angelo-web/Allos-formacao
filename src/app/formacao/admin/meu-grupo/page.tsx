// A tela do condutor mudou de casa: agora é /formacao/associados/sincrono.
//
// Saiu do painel porque quem conduz um grupo não administra a plataforma —
// está preparando um encontro, não configurando o sistema. A pasta antiga foi
// removida e sobrou só este redirecionamento, porque o endereço circulou por
// meses: era para onde o menu apontava, e é o que está salvo nos favoritos de
// quem abre a própria sala toda semana.

import { redirect } from "next/navigation";

export default function MeuGrupoMudouDeCasa() {
  redirect("/formacao/associados/sincrono");
}
