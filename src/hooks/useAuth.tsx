import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../lib/authService';
import type { Profile, Session } from '../lib/authService';

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  permissions: string[];
  loading: boolean;
  /** Signed in, but the profile couldn't be loaded after retries (server unreachable) */
  profileUnavailable: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => authService.getCurrentSession());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // True when the user is signed in but their profile could not be loaded (server unreachable)
  const [profileUnavailable, setProfileUnavailable] = useState(false);

  /**
   * Load the profile, retrying transient failures (a cold start right after a deploy,
   * a brief network or database hiccup) so a signed-in user is never shown as logged
   * out or denied. Stops early if the server rejected the session (a 401 signs out).
   */
  async function fetchProfile(userId: string): Promise<void> {
    const delays = [0, 1000, 2500, 5000];
    for (const wait of delays) {
      if (wait) await new Promise(r => setTimeout(r, wait));
      if (!authService.getCurrentSession()) return; // session was revoked / expired
      const { data, error } = await authService.getProfile(userId);
      if (!error && data) {
        setProfile(data);
        setProfileUnavailable(false);
        return;
      }
    }
    if (authService.getCurrentSession()) setProfileUnavailable(true);
  }

  async function refreshProfile(): Promise<void> {
    if (session?.user) await fetchProfile(session.user.id);
  }

  useEffect(() => {
    // Bootstrap profile on mount if session exists
    const initialSession = authService.getCurrentSession();
    const bootstrap = async () => {
      if (initialSession?.user) {
        await fetchProfile(initialSession.user.id);
      }
      setLoading(false);
    };
    
    void bootstrap();

    // Listen to auth state changes
    const { data: { subscription } } = authService.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await authService.signOut();
    setProfile(null);
    setSession(null);
    setProfileUnavailable(false);
  };

  const permissions = profile?.permissions || [];

  return (
    <AuthContext.Provider value={{ session, profile, permissions, loading, profileUnavailable, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
