import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const STORAGE_KEY = "sb-auth-cookies";

function getStoredCookies(): { name: string; value: string }[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setStoredCookies(
  cookies: { name: string; value: string; options?: Record<string, unknown> }[]
) {
  if (typeof window === "undefined") return;
  // Merge with existing: update matching names, add new ones
  const existing = getStoredCookies();
  const map = new Map(existing.map((c) => [c.name, c.value]));
  for (const c of cookies) {
    if (c.value) {
      map.set(c.name, c.value);
    } else {
      map.delete(c.name); // empty value = delete
    }
  }
  const result: { name: string; value: string }[] = [];
  map.forEach((value, name) => result.push({ name, value }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
}

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return getStoredCookies();
      },
      setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]) {
        setStoredCookies(cookies);
      },
    },
  });
  return client;
}
