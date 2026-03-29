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
import type { Profile } from "@/types";
import type { User, Session } from "@supabase/supabase-js";

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
  const [initCounter, setInitCounter] = useState(0);
  // Re-create client when initCounter changes (bfcache restore)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), [initCounter]);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        setProfile(data);
      } catch (err) {
        console.error("[AUTH] fetchProfile error:", err);
      }
    },
    [supabase]
  );

  /**
   * Apply a session: update user state, fetch profile, update ref.
   * Returns the user if successful, null otherwise.
   */
  const applySession = useCallback(
    async (session: Session | null) => {
      const authUser = session?.user ?? null;
      currentUserIdRef.current = authUser?.id ?? null;
      setUser(authUser);
      if (authUser) {
        await fetchProfile(authUser.id);
      } else {
        setProfile(null);
      }
      return authUser;
    },
    [fetchProfile]
  );

  // Re-initialize auth on bfcache restore (F5 / back-forward navigation).
  // When the browser restores a page from bfcache, the entire JS heap is
  // reused, so useEffect cleanup never ran and refs keep stale values.
  // The "pageshow" event with persisted=true detects this case.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        resetClient();
        setLoading(true);
        setInitCounter((c) => c + 1);
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Step 1: Use server-provided session FIRST (most reliable).
        // SSR reads HTTP cookies directly — no document.cookie, no hang risk.
        if (initialSession?.access_token && !cancelled) {
          console.log("[AUTH] step1: using SSR initialSession");
          const { data, error } = await supabase.auth.setSession({
            access_token: initialSession.access_token,
            refresh_token: initialSession.refresh_token,
          });
          console.log("[AUTH] step1 result:", error ? error.message : "ok", data.session ? "session" : "null");
          if (!cancelled && data.session) {
            await applySession(data.session);
            setLoading(false);
            return;
          }
        }

        // Step 2: Try localStorage (via custom cookie handler).
        // Use Promise.race with timeout to prevent hang.
        if (!cancelled) {
          console.log("[AUTH] step2: trying localStorage");
          const result = await Promise.race([
            supabase.auth.getSession(),
            new Promise<null>((r) => setTimeout(() => r(null), 3000)),
          ]);
          const localSession = result?.data?.session ?? null;
          console.log("[AUTH] step2 result:", localSession ? "found" : "null/timeout");
          if (localSession?.user && !cancelled) {
            await applySession(localSession);
            setLoading(false);
            return;
          }
        }

        // Step 3: Fallback — fetch from server endpoint.
        if (!cancelled) {
          console.log("[AUTH] step3: trying session endpoint");
          try {
            const res = await fetch("/formacao/auth/session", {
              credentials: "include",
              cache: "no-store",
            });
            if (res.ok) {
              const json = await res.json();
              if (json.session?.access_token && !cancelled) {
                const { data } = await supabase.auth.setSession({
                  access_token: json.session.access_token,
                  refresh_token: json.session.refresh_token,
                });
                if (!cancelled && data.session) {
                  console.log("[AUTH] step3 result: ok");
                  await applySession(data.session);
                  setLoading(false);
                  return;
                }
              }
            }
          } catch {
            // endpoint not reachable
          }
        }

        console.log("[AUTH] no session found");
        if (!cancelled) setLoading(false);
      } catch (err) {
        console.error("[AUTH] init error:", err);
        if (!cancelled) setLoading(false);
      }
    }

    init();

    // Listen for auth state changes (token refresh, sign out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      const newUser = session?.user ?? null;
      const newUserId = newUser?.id ?? null;

      // Skip if the user hasn't changed
      if (newUserId === currentUserIdRef.current) return;

      currentUserIdRef.current = newUserId;
      setUser(newUser);
      if (newUser) {
        await fetchProfile(newUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile, initialSession, applySession, initCounter]);

  const signOut = useCallback(async () => {
    currentUserIdRef.current = null;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    // Also clear localStorage to prevent stale data on next visit
    try {
      localStorage.removeItem("sb-auth-cookies");
    } catch {
      // ignore
    }
  }, [supabase]);

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
