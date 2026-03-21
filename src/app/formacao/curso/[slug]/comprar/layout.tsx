import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface LayoutProps {
  children: React.ReactNode;
  params: { slug: string };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const supabase = await createServerSupabaseClient();

  const { data: course } = await supabase
    .from("courses")
    .select("title, description, thumbnail_url")
    .eq("slug", params.slug)
    .single();

  if (!course) {
    return {
      title: "Curso não encontrado — Allos Formação",
    };
  }

  const description = course.description
    ? course.description.length > 160
      ? course.description.slice(0, 157) + "..."
      : course.description
    : undefined;

  const images = course.thumbnail_url ? [course.thumbnail_url] : undefined;

  return {
    title: `Comprar: ${course.title} — Allos Formação`,
    description,
    openGraph: {
      title: `Comprar: ${course.title} — Allos Formação`,
      description,
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `Comprar: ${course.title} — Allos Formação`,
      description,
    },
  };
}

export default function ComprarLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
