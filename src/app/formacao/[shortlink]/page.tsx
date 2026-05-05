// Atalho publico: /formacao/<slug> -> redirect 302 pra destination_url.
// Resolve via RPC SECURITY DEFINER que tambem incrementa clicks na tabela study_links.
// Rotas estaticas (/formacao/admin, /formacao/curso, etc) tem prioridade
// natural sobre [shortlink] no Next App Router.
// Gerenciado em /formacao/admin/atalhos.

import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RESERVED_STUDY_LINK_SLUGS } from "@/lib/utils/studyLink";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ResolveStudyLinkRow = { destination_url: string | null };

export default async function StudyLinkRedirectPage({
  params,
}: {
  params: { shortlink: string };
}) {
  const slug = decodeURIComponent(params.shortlink).toLowerCase();

  if (RESERVED_STUDY_LINK_SLUGS.has(slug)) notFound();

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("resolve_study_link", {
    p_slug: slug,
  });

  if (error || !data || (data as ResolveStudyLinkRow[]).length === 0) notFound();

  const url = (data as ResolveStudyLinkRow[])[0]?.destination_url;
  if (!url) notFound();

  redirect(url);
}
