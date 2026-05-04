import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Só roda nas rotas que precisam de auth/role check no servidor.
  // Demais rotas (home, /cursos, /auth, /api/*) passam direto, evitando
  // 1-2 round-trips ao Supabase por request.
  matcher: ["/formacao/admin/:path*", "/formacao/curso/:path*"],
};
