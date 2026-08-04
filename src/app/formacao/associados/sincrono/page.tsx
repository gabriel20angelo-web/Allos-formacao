// A subseção de quem conduz um grupo.
//
// O gate é próprio, e não herdado do layout: quem só cuida de eventos entra na
// área e não tem o que fazer aqui. Layout que autoriza a área inteira autoriza
// demais.

import type { Metadata } from "next";
import { exigirAlgumCargo } from "@/lib/auth-servidor";
import TelaDoGrupo from "./Tela";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meu grupo — Allos Formação",
  robots: { index: false, follow: false },
};

export default async function PaginaSincrono() {
  await exigirAlgumCargo(["condutor"], "/formacao/associados/sincrono");
  return <TelaDoGrupo />;
}
