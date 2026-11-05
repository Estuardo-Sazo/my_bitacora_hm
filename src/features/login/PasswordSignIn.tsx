import type { FormEvent } from 'react';
import { useState } from 'react';
import { Notice } from '@/components/Notice';
import { useSession } from '@/session/sessionContext';
import styles from './LoginScreen.module.css';

export function PasswordSignIn() {
  const { signInWithPassword } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    signInWithPassword(email.trim(), password)
      .catch(() => {
        setError('Correo o contraseña incorrectos.');
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <label>
        <span>Correo</span>
        <input
          type="email"
          autoComplete="username"
          autoCapitalize="off"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      </label>
      <label>
        <span>Contraseña</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
      </label>
      <div className={styles.actions}>
        <button type="submit" className="button button-primary" disabled={busy}>
          Entrar
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </form>
  );
}
