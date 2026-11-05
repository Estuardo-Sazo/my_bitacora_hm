import { createContext, useContext } from 'react';
import type { LogbookRepository } from '@/data/repository';

export interface SessionUser {
  name: string;
  email: string;
}

export type Session =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'denied'; email: string; userId: string }
  | { status: 'demo'; repository: LogbookRepository }
  | { status: 'ready'; user: SessionUser; repository: LogbookRepository };

export interface SessionActions {
  session: Session;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
  exitDemo: () => void;
}

export const SessionContext = createContext<SessionActions | null>(null);

export function useSession(): SessionActions {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de SessionProvider');
  return value;
}
