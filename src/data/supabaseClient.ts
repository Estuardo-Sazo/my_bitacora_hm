import { createClient } from '@supabase/supabase-js';
import type { Session as AuthSession } from '@supabase/supabase-js';
import type { SessionUser } from '@/session/sessionContext';
import type { LogbookRepository } from './repository';
import { supabaseOptions } from './supabaseConfig';
import { createSupabaseRemote } from './supabaseRemote';
import { clearLocalCopy, createSyncedRepository } from './syncedRepository';

const client = createClient(supabaseOptions.url ?? '', supabaseOptions.publishableKey ?? '', {
  // PKCE returns in the query string, which leaves the hash free for the app's router.
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type AuthState =
  | { status: 'signedOut' }
  | { status: 'denied'; email: string; userId: string }
  | { status: 'ready'; user: SessionUser; repository: LogbookRepository };

/**
 * Signing in only proves identity. Access needs a row in `allowed_users`, which only the project
 * owner can create, so a stranger's account reaches nothing.
 */
async function isAllowed(userId: string): Promise<boolean> {
  const { data, error } = await client
    .from('allowed_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  // Offline there is no answer yet. The local copy stays usable and the database still enforces
  // access on every request.
  if (error) return !navigator.onLine;
  return data !== null;
}

async function resolveAuthState(session: AuthSession | null): Promise<AuthState> {
  if (!session) return { status: 'signedOut' };
  const { id } = session.user;
  const email = session.user.email ?? '';
  if (!(await isAllowed(id))) return { status: 'denied', email, userId: id };

  const name = (session.user.user_metadata as { full_name?: string }).full_name ?? email;
  return {
    status: 'ready',
    user: { name, email },
    repository: createSyncedRepository(createSupabaseRemote(client, id), id),
  };
}

export function watchAuth(onChange: (state: AuthState) => void): () => void {
  let currentUserId: string | null | undefined;

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    // Token refreshes fire this too; only a different user needs a new repository.
    const userId = session?.user.id ?? null;
    if (userId === currentUserId) return;
    currentUserId = userId;
    // Calling Supabase inside this callback can deadlock its auth lock, so leave it first.
    setTimeout(() => {
      void resolveAuthState(session).then(onChange);
    }, 0);
  });
  return () => {
    data.subscription.unsubscribe();
  };
}

const redirectUrl = () => `${location.origin}${location.pathname}`;

export async function signInWithGoogle(): Promise<void> {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl() },
  });
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl() },
  });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await client.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function signOutUser(): Promise<void> {
  const { data } = await client.auth.getSession();
  await client.auth.signOut();
  if (data.session) clearLocalCopy(data.session.user.id);
}
