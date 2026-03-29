"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function DebugPage() {
  const auth = useAuth();
  const [coursesResult, setCoursesResult] = useState<string>("loading...");
  const [fetchResult, setFetchResult] = useState<string>("loading...");
  const [cookieList, setCookieList] = useState<string>("");

  useEffect(() => {
    setCookieList(document.cookie || "(vazio)");

    // Test 1: raw fetch
    fetch("https://syiaushvzhgyhvsmoegt.supabase.co/rest/v1/courses?select=id,title&status=eq.published&limit=2", {
      headers: {
        apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aWF1c2h2emhneWh2c21vZWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODU3ODMsImV4cCI6MjA5MDA2MTc4M30.8aLqek5JRvILounYZJr-lKqL7UVzbCV4KSeF73nYo-M",
      },
    })
      .then((r) => r.json())
      .then((d) => setFetchResult("OK: " + JSON.stringify(d)))
      .catch((e) => setFetchResult("ERRO: " + e.message));

    // Test 2: supabase client
    try {
      const client = createClient();
      client
        .from("courses")
        .select("id, title")
        .eq("status", "published")
        .limit(2)
        .then(({ data, error }) => {
          if (error) setCoursesResult("ERRO: " + JSON.stringify(error));
          else setCoursesResult("OK: " + JSON.stringify(data));
        });
    } catch (e: unknown) {
      setCoursesResult("EXCEPTION: " + (e instanceof Error ? e.message : String(e)));
    }
  }, []);

  return (
    <div style={{ padding: 40, color: "white", fontFamily: "monospace", fontSize: 14, lineHeight: 2 }}>
      <h1>Debug Page</h1>
      <p><b>Auth loading:</b> {String(auth.loading)}</p>
      <p><b>Auth user:</b> {auth.user ? auth.user.email : "null"}</p>
      <p><b>Auth profile:</b> {auth.profile ? auth.profile.full_name + " (" + auth.profile.role + ")" : "null"}</p>
      <hr />
      <p><b>Raw fetch cursos:</b> {fetchResult}</p>
      <p><b>Supabase client cursos:</b> {coursesResult}</p>
      <hr />
      <p><b>Cookies:</b> {cookieList}</p>
      <p><b>localStorage keys:</b> {typeof window !== "undefined" ? Object.keys(localStorage).join(", ") || "(vazio)" : "ssr"}</p>
    </div>
  );
}
