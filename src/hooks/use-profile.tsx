import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

interface ProfileContextType {
  displayName: string | null;
  loading: boolean;
  /** True when we know the user has no display_name and needs to set one. */
  needsName: boolean;
  refresh: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const PROFILE_UPDATED_EVENT = "profile:updated";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const upsertAttempted = useRef<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setDisplayName(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    let name: string | null = null;
    if (!error && data) {
      name = (data.display_name || "").trim() || null;
    }

    // Defensive upsert: if profile missing/empty but the auth provider gave
    // us a name (Google), populate it once per session.
    if (!name && upsertAttempted.current !== user.id) {
      upsertAttempted.current = user.id;
      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      const metaName = (
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        ""
      ).trim();
      if (metaName) {
        const { error: upErr } = await supabase
          .from("profiles")
          .upsert({ user_id: user.id, display_name: metaName }, { onConflict: "user_id" });
        if (!upErr) name = metaName;
      }
    }

    setDisplayName(name);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    fetchProfile();
  }, [authLoading, fetchProfile]);

  const updateDisplayName = useCallback(
    async (name: string): Promise<{ error: string | null }> => {
      if (!user) return { error: "Não autenticado" };
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 60) {
        return { error: "O nome deve ter entre 2 e 60 caracteres" };
      }
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, display_name: trimmed }, { onConflict: "user_id" });
      if (error) return { error: error.message };
      setDisplayName(trimmed);
      // Notifica consumidores (grupos, relatórios) para recarregarem.
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      return { error: null };
    },
    [user]
  );

  const value: ProfileContextType = {
    displayName,
    loading,
    needsName: !!user && !loading && !displayName,
    refresh: fetchProfile,
    updateDisplayName,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextType {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
