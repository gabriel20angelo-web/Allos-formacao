import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
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
          // read-only
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
  };

  if (!session) {
    return Response.json({ session: null }, { headers });
  }

  return Response.json(
    {
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    },
    { headers }
  );
}
