import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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
  title: "Allos Formacao -- Plataforma de Cursos",
  description:
    "Plataforma de cursos e formacao continuada da Associacao Allos. Psicologia, pesquisa e formacao de excelencia.",
};

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Read session from HTTP cookies on the server.
 * This is a fallback for when localStorage was cleared but cookies still exist
 * (e.g., user cleared browser data but cookies were preserved, or new tab).
 */
async function getServerSession() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // read-only in layout
          },
        },
      }
    );
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      // Não passar refresh_token pra hidratação SSR — XSS na primeira
      // pintura captura. useAuth/AuthProvider só precisa do access_token
      // pra decodificar o JWT no boot. Refresh segue nos cookies HttpOnly.
      return {
        access_token: session.access_token,
        refresh_token: "",
      };
    }
  } catch {
    // Server session read failed -- client will handle auth
  }
  return null;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialSession = await getServerSession();

  return (
    <html lang="pt-BR" className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-dm relative z-10 bg-[#111111]">
        <AuthProvider initialSession={initialSession}>
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
