import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, profile: null });

  const load = useCallback(async (session) => {
    if (!session) return setState({ loading: false, profile: null });
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    // Profile row na mile to khaali student profile maante hain (complete-profile screen aayegi)
    const base = data || {
      id: session.user.id,
      full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || "",
      room_number: "",
      phone: "",
      role: "student",
    };
    setState({ loading: false, profile: { ...base, email: session.user.email } });
  }, []);

  useEffect(() => {
    // Supabase callback ke andar seedha await nahi karte (deadlock se bachne ke liye)
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  }, [load]);

  const value = useMemo(
    () => ({ ...state, refresh, signOut: () => supabase.auth.signOut() }),
    [state, refresh]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}