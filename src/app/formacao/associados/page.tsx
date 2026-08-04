// A porta da área não tem tela própria.
//
// Um índice com cards apontando para as subseções seria um clique a mais para
// dizer o que a barra de navegação logo acima já diz. Quem entra é levado
// direto ao trabalho: a primeira subseção que couber ao cargo dela.

import { redirect } from "next/navigation";
import { exigirAlgumCargo } from "@/lib/auth-servidor";
import { CARGOS_DOS_ASSOCIADOS, CASA_DOS_ASSOCIADOS, homeDosAssociados } from "@/lib/areas";

export const dynamic = "force-dynamic";

export default async function PortaDosAssociados() {
  const quem = await exigirAlgumCargo(CARGOS_DOS_ASSOCIADOS, CASA_DOS_ASSOCIADOS);
  redirect(homeDosAssociados(quem.cargos) || "/formacao");
}
