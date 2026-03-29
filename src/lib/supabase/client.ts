import { createBrowserClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      detectSessionInUrl: false,
    },
  });
  return client;
}

// Client for data-only queries (no auth initialization, never hangs)
let dataClient: ReturnType<typeof createJsClient> | null = null;

export function createDataClient() {
  if (dataClient) return dataClient;
  dataClient = createJsClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return dataClient;
}
