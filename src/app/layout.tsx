import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import "@/styles/globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://allos.org.br"),
  title: "Formação Allos",
  description:
    "Plataforma de cursos e formacao continuada da Associacao Allos. Psicologia, pesquisa e formacao de excelencia.",
};

// Sem force-dynamic e sem cookies()/getServerSession aqui: qualquer chamada
// server-side a cookies() força toda a árvore a virar dynamic, custando
// ~400-600ms de TTFB em rotas públicas que não precisam de auth no servidor.
// AuthProvider já tem fallback pra localStorage (sb-auth-cookies populada
// pelo bridge em /formacao/auth/callback). Páginas que precisam de SSR auth
// (admin, curso) declaram dynamic individualmente e o middleware cobre o
// role check pra rotas protegidas.

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-dm relative z-10 bg-[#111111]">
        <AuthProvider>
          <a href="#main-content" className="skip-link">
            Pular para conteudo principal
          </a>
          <main id="main-content" className="relative z-10">
            {children}
          </main>
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              style: {
                fontFamily: "var(--font-dm)",
                borderRadius: "10px",
                background: "rgba(30,30,30,0.95)",
                border: "1px solid rgba(200,75,49,0.15)",
                color: "#FDFBF7",
                backdropFilter: "blur(12px)",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
