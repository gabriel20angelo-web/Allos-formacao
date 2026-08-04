// A subseção de quem cuida dos eventos.
//
// Estava em /formacao/admin/eventos, com casca de painel, e não é
// administração da plataforma: é alguém marcando um evento no calendário
// público. O componente da aba é o mesmo que o administrador abre dentro do
// Calendário — não há duas telas de eventos, há uma, alcançada por dois
// caminhos.
//
// O gate é próprio, e não herdado do layout: quem só conduz um grupo entra na
// área e não tem o que fazer aqui. Layout que autoriza a área inteira autoriza
// demais. E ele é de servidor, o que dispensa o "Acesso restrito" que a versão
// antiga desenhava depois de já ter carregado a tela.

import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { exigirAlgumCargo } from "@/lib/auth-servidor";
import EventosTab from "@/components/admin/calendario/EventosTab";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eventos — Allos Formação",
  robots: { index: false, follow: false },
};

export default async function PaginaEventos() {
  await exigirAlgumCargo(["eventos"], "/formacao/associados/eventos");

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="h-5 w-5" style={{ color: "#C84B31" }} />
          <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
            Eventos
          </h1>
        </div>
        <p className="text-sm text-cream/35 mt-1 font-dm">
          Crie e gerencie os eventos que aparecem no calendário público da
          formação.
        </p>
      </div>

      <EventosTab />
    </div>
  );
}
