// Auth client-side via decode direto de JWT — bypassa supabase.auth.* porque
// os métodos do @supabase/ssr travam em alguns navegadores (incidente Brave +
// shields, ver memory project_oauth_debug). Estratégia atual:
//
// 1. SSR injeta tokens via initialSession (mais confiável)
// 2. Fallback: lê access_token do localStorage (chave sb-auth-cookies, populada
//    pelo bridge em /formacao/auth/callback)
// 3. fetchProfile() consulta tabela `profiles` pra montar role/avatar/nome
//
// signOut() só faz POST pra /auth/sign-out + window.location.href pra limpar
// estado client-side; o middleware lida com cookies sb-*.

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { createElement } from "react";
import { createClient, resetClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { Profile } from "@/types";
import type { User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isInstructor: boolean;
  isStudent: boolean;
  isAssociado: boolean;
}

interface InitialSession {
  access_token: string;
  refresh_token: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "sb-auth-cookies";

/**
 * Decode a JWT payload without verification.
 * Safe because the token came from our own server.
 */
function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * Build a minimal User object from JWT payload.
 */
function userFromJWT(token: string): User | null {
  const payload = decodeJWT(token);
  if (!payload?.sub) return null;

  // Check expiration
  if (payload.exp && (payload.exp as number) * 1000 < Date.now()) {
    return null; // token expired
  }

  return {
    id: payload.sub as string,
    email: (payload.email as string) || "",
    user_metadata: (payload.user_metadata as Record<string, unknown>) || {},
    app_metadata: (payload.app_metadata as Record<string, unknown>) || {},
    aud: (payload.aud as string) || "authenticated",
    created_at: "",
  } as User;
}

/**
 * Try to get access_token from localStorage (the sb-auth-cookies store).
 * The cookies contain chunked session data that includes the tokens.
 */
function getTokenFromLocalStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cookies: { name: string; value: string }[] = JSON.parse(raw);

    // Reassemble chunked cookies into a single string
    const authCookies = cookies
      .filter((c) => c.name.includes("-auth-token") && !c.name.includes("code-verifier"))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (authCookies.length === 0) return null;

    // The cookie value is a base64-encoded JSON with access_token and refresh_token
    const combined = authCookies.map((c) => c.value).join("");
    // Try decoding as base64url first, then raw
    let sessionStr: string;
    try {
      sessionStr = atob(combined.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      sessionStr = combined;
    }
    const session = JSON.parse(sessionStr);
    return session?.access_token || null;
  } catch {
    return null;
  }
}

export function AuthProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession?: InitialSession | null;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url, role, certificate_name, created_at, updated_at")
          .eq("id", userId)
          .single();
        setProfile(data);
      } catch (err) {
        logger.error("AUTH", "fetchProfile error:", err);
      }
    },
    [supabase]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Strategy: decode JWT directly — never call supabase.auth.*
        // (those methods hang in Brave due to @supabase/ssr internals)

        let authUser: User | null = null;

        // 1. Try SSR-provided session (most reliable)
        if (initialSession?.access_token) {
          authUser = userFromJWT(initialSession.access_token);
          logger.debug("AUTH", "SSR session:", authUser ? authUser.email : "expired/invalid");
        }

        // 2. Try localStorage
        if (!authUser) {
          const lsToken = getTokenFromLocalStorage();
          if (lsToken) {
            authUser = userFromJWT(lsToken);
            logger.debug("AUTH", "localStorage session:", authUser ? authUser.email : "expired/invalid");
          } else {
            logger.debug("AUTH", "localStorage: empty");
          }
        }

        if (cancelled) return;

        if (authUser) {
          currentUserIdRef.current = authUser.id;
          setUser(authUser);
          await fetchProfile(authUser.id);
        } else {
          logger.debug("AUTH", "no valid session found");
        }
      } catch (err) {
        logger.error("AUTH", "init error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    // Detect bfcache restore — reset the Supabase singleton first so the
    // next createClient() rebuilds with fresh in-memory state (otherwise
    // the client can hold stale tokens / listeners from the prior page
    // load).
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        resetClient();
        init();
      }
    }
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [initialSession, fetchProfile]);

  const signOut = useCallback(async () => {
    currentUserIdRef.current = null;
    setUser(null);
    setProfile(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    // Server-side: invalida o refresh token no Supabase + limpa cookies
    // HttpOnly que o JS não consegue clarear sozinho.
    try {
      await fetch("/formacao/auth/sign-out", {
        method: "POST",
        credentials: "include",
        headers: { "X-Allos-Auth": "1" },
      });
    } catch (err) {
      logger.warn("useAuth", "sign-out endpoint failed:", err);
    }
    window.location.href = "/formacao/auth";
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signOut,
      isAdmin: profile?.role === "admin",
      isInstructor: profile?.role === "instructor",
      isStudent: profile?.role === "student",
      isAssociado: profile?.role === "associado",
    }),
    [user, profile, loading, signOut]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
