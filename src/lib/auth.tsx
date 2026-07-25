import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  /** Undetermined-yet vs. genuinely signed-out — lets screens show a
   *  loading state instead of flashing a "sign in" prompt on launch. */
  loading: boolean;
  /** True for a brief window around sign-out/account-deletion — lets a
   *  single global overlay (see SplashTransition in the root layout) cover
   *  the redirect to /login, instead of each screen racing its own
   *  timeout against the tabs layout's immediate auth-gate redirect. */
  signingOut: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    // Hold the overlay a beat after the auth state flips so the redirect to
    // /login resolves underneath it, instead of appearing as an abrupt cut.
    await new Promise((resolve) => setTimeout(resolve, 550));
    setSigningOut(false);
  }

  return (
    <AuthContext.Provider value={{ session, loading, signingOut, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
