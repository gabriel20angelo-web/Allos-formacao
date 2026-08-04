// A área de eventos mudou de casa: agora é /formacao/associados/eventos.
//
// Saiu do painel porque quem cuida dos eventos não administra a plataforma — a
// casca escura de painel dizia o contrário e obrigava a passar por um menu que
// não era dela. O arquivo fica porque este endereço circulou por meses: era
// para onde o menu apontava, e é o que está salvo nos favoritos de quem
// trabalha aqui toda semana.

import { redirect } from "next/navigation";

export default function EventosMudouDeCasa() {
  redirect("/formacao/associados/eventos");
}
