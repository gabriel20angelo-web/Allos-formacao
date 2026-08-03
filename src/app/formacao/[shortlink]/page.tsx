// Atalho público: /formacao/<slug> → entra no encontro.
//
// Isto era um redirect de servidor, e por isso o link não tinha cara nenhuma no
// WhatsApp. O crawler da Meta usa as tags do DESTINO FINAL da cadeia de
// redirecionamento, e o Google Meet devolve a MESMA prévia para toda e
// qualquer sala: título "Meet", logo do Google, descrição em inglês. Verificado
// contra três códigos de reunião diferentes — resposta idêntica byte por byte.
// Não há como personalizar isso pelo lado deles.
//
// A saída é o inverso do intuitivo: o crawler NÃO executa JavaScript. Então a
// página responde 200 com o HTML da Allos, que ele lê, e o encaminhamento ao
// Meet acontece no navegador, que ele nunca roda. Quem compartilha vê a prévia
// certa; quem clica entra na reunião.
//
// Gerenciado em /formacao/admin/atalhos.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { RESERVED_STUDY_LINK_SLUGS } from "@/lib/utils/studyLink";
import EntrarNoEncontro from "./EntrarNoEncontro";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://allos.org.br";

interface Atalho {
  destino: string;
  nome: string | null;
}

/**
 * O destino e o nome do grupo.
 *
 * Sem contar clique: quem chama isto é o `generateMetadata`, e ele roda toda
 * vez que alguém cola o link em qualquer lugar. Contar aqui inflaria a conta
 * com pré-visualizações que ninguém abriu.
 */
async function lerAtalho(slug: string): Promise<Atalho | null> {
  const sb = await createServiceRoleClient();

  const { data: link } = await sb
    .from("study_links")
    .select("destination_url, space_name, label")
    .eq("slug", slug)
    .maybeSingle();

  if (!link) return null;

  if (link.space_name) {
    const { data: sala } = await sb
      .from("formacao_meet_spaces")
      .select("meeting_uri, rotulo, slot_id, ativo")
      .eq("space_name", link.space_name)
      .maybeSingle();

    if (!sala?.ativo || !sala.meeting_uri) return null;

    let nome = link.label || sala.rotulo || null;
    if (!nome && sala.slot_id) {
      const { data: slot } = await sb
        .from("formacao_slots")
        .select("atividade_nome")
        .eq("id", sala.slot_id)
        .maybeSingle();
      nome = slot?.atividade_nome || null;
    }
    return { destino: sala.meeting_uri, nome };
  }

  return link.destination_url
    ? { destino: link.destination_url, nome: link.label }
    : null;
}

export async function generateMetadata({
  params,
}: {
  params: { shortlink: string };
}): Promise<Metadata> {
  const slug = decodeURIComponent(params.shortlink).toLowerCase();
  const atalho = await lerAtalho(slug);

  if (!atalho) return { title: "Encontro não encontrado" };

  // Duas linhas no título e cerca de oitenta caracteres na descrição é o que o
  // WhatsApp mostra antes de cortar. O nome do grupo vem primeiro porque é o
  // que a pessoa procura na lista de conversas.
  const titulo = atalho.nome
    ? `${atalho.nome} — entrar agora`
    : "Entrar no encontro agora";

  const descricao = "Toque para entrar na sala. Encontro online da Associação Allos.";
  const imagem = `${APP_URL}/formacao/${slug}/opengraph-image`;

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      url: `${APP_URL}/formacao/${slug}`,
      siteName: "Allos",
      locale: "pt_BR",
      type: "website",
      images: [{ url: imagem, width: 1200, height: 630, alt: titulo }],
    },
    twitter: { card: "summary_large_image", title: titulo, description: descricao, images: [imagem] },
    robots: { index: false, follow: false },
  };
}

export default async function AtalhoPage({
  params,
}: {
  params: { shortlink: string };
}) {
  const slug = decodeURIComponent(params.shortlink).toLowerCase();

  if (RESERVED_STUDY_LINK_SLUGS.has(slug)) notFound();

  // Aqui sim conta o clique: chegou uma pessoa, não um robô montando prévia.
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("resolve_study_link", { p_slug: slug });

  if (error || !data || (data as { destination_url: string | null }[]).length === 0) {
    notFound();
  }

  const destino = (data as { destination_url: string | null }[])[0]?.destination_url;
  if (!destino) notFound();

  const atalho = await lerAtalho(slug);

  return <EntrarNoEncontro destino={destino} nome={atalho?.nome || null} />;
}
