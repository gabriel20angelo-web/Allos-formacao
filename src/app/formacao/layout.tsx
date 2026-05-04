import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import SidebarOffset from "@/components/layout/SidebarOffset";
import FloatingQuestionButton from "@/components/ui/FloatingQuestionButton";
import type { Metadata } from "next";

// Sem force-dynamic: Sidebar/TopBar são client components e leem auth no
// browser. Forçar dynamic estava custando ~400-600ms de TTFB em todo
// /formacao, sem ganho — páginas que precisam de dynamic real já declaram
// isso individualmente (admin/page.tsx, curso/[slug]/...).

export const metadata: Metadata = {
  title: "Formação Allos",
  description:
    "Explore nossos cursos de psicologia, pesquisa e formação continuada. Cursos gravados, ao vivo e formação síncrona contínua pela Associação Allos.",
  keywords: [
    "psicologia", "cursos", "formação continuada", "terapia",
    "psicoterapia", "Allos", "certificado", "clínica",
  ],
  openGraph: {
    title: "Formação Allos",
    description: "Formação clínica crítica e existencial. Cursos de psicologia e áreas correlatas pela Associação Allos.",
    type: "website",
    locale: "pt_BR",
    siteName: "Formação Allos",
  },
  twitter: {
    card: "summary_large_image",
    title: "Formação Allos",
    description: "Formação clínica crítica e existencial. Cursos pela Associação Allos.",
  },
};

export default function FormacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />
      <SidebarOffset>
        <TopBar />
        <main className="min-h-screen pb-20 md:pb-0">{children}</main>
      </SidebarOffset>
      <FloatingQuestionButton />
    </>
  );
}
