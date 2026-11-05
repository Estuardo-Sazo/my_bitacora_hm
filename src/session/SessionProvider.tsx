import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createLocalRepository } from '@/data/localRepository';
import type { AuthState } from '@/data/supabaseClient';
import { isSupabaseConfigured } from '@/data/supabaseConfig';
import type { Session, SessionActions } from './sessionContext';
import { SessionContext } from './sessionContext';

const DEMO_FLAG = 'bitacora.demo.active';

const loadSupabase = () => import('@/data/supabaseClient');

export function SessionProvider({ children }: { children: ReactNode }) {
  const [demoActive, setDemoActive] = useState(() => localStorage.getItem(DEMO_FLAG) === 'true');
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const demoRepository = useMemo(() => (demoActive ? createLocalRepository() : null), [demoActive]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    let stop: (() => void) | undefined;
    loadSupabase().then(
      ({ watchAuth }) => {
        if (active) stop = watchAuth(setAuthState);
      },
      () => {
        // Never leave the user on a spinner: the login screen still offers the demo.
        if (active) setAuthState({ status: 'signedOut' });
      },
    );
    return () => {
      active = false;
      stop?.();
    };
  }, []);

  const session = useMemo<Session>(() => {
    if (authState?.status === 'ready') return authState;
    if (demoRepository) return { status: 'demo', repository: demoRepository };
    if (authState) return authState;
    return isSupabaseConfigured ? { status: 'loading' } : { status: 'signedOut' };
  }, [authState, demoRepository]);

  const setDemo = useCallback((active: boolean) => {
    if (active) localStorage.setItem(DEMO_FLAG, 'true');
    else localStorage.removeItem(DEMO_FLAG);
    setDemoActive(active);
  }, []);

  const value = useMemo<SessionActions>(
    () => ({
      session,
      signInWithGoogle: async () => {
        await (await loadSupabase()).signInWithGoogle();
      },
      sendEmailCode: async (email) => {
        await (await loadSupabase()).sendEmailCode(email);
      },
      verifyEmailCode: async (email, code) => {
        await (await loadSupabase()).verifyEmailCode(email, code);
      },
      signOut: async () => {
        await (await loadSupabase()).signOutUser();
      },
      enterDemo: () => {
        setDemo(true);
      },
      exitDemo: () => {
        setDemo(false);
      },
    }),
    [session, setDemo],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
