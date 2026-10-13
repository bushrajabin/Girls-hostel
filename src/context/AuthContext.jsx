import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, profile: null });

  useEffect(() => {
    async function load(session) {
      if (!session) return setState({ loading: false, profile: null });
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      setState({
        loading: false,
        profile: data ? { ...data, email: session.user.email } : null,
      });
    }

    // Supabase callback ke andar seedha await nahi karte (deadlock se bachne ke liye)
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ ...state, signOut: () => supabase.auth.signOut() }),
    [state]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
