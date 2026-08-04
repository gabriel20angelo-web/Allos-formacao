// A casa de quem trabalha nos grupos.
//
// Meu grupo, Aprimoramento e Eventos moravam em três cantos do sistema, dois
// deles dentro do painel de administração. É a mesma pessoa usando as três, e
// nenhuma delas está administrando a plataforma: está conduzindo um encontro,
// escolhendo uma dinâmica, marcando um evento. A casca escura de painel dizia
// o contrário, e obrigava a lembrar em qual menu estava o quê.
//
// O gate está aqui e também em cada subseção, e não é redundância: aqui se
// pergunta "esta pessoa entra na área?", lá dentro "esta pessoa vê ESTA
// subseção?". Quem só cuida de eventos entra, e mesmo assim não abre o
// Síncrono.

import { exigirAlgumCargo } from "@/lib/auth-servidor";
import { CARGOS_DOS_ASSOCIADOS, CASA_DOS_ASSOCIADOS, secoesDaPessoa } from "@/lib/areas";
import NavDasSecoes from "./NavDasSecoes";

export const dynamic = "force-dynamic";

export default async function LayoutDosAssociados({
  children,
}: {
  children: React.ReactNode;
}) {
  const quem = await exigirAlgumCargo(CARGOS_DOS_ASSOCIADOS, CASA_DOS_ASSOCIADOS);
  const secoes = secoesDaPessoa(quem.cargos);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-10">
      <NavDasSecoes secoes={secoes} />
      {children}
    </div>
  );
}
