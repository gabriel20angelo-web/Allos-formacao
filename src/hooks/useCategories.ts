"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_CATEGORIES } from "@/lib/constants";

export function useCategories() {
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await createClient()
        .from("categories")
        .select("name")
        .order("name");

      if (data && data.length > 0) {
        setCategories(data.map((c) => c.name));
      }
      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, []);

  return { categories, loading };
}
