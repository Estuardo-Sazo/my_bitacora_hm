import type { FormEvent } from 'react';
import { useState } from 'react';
import { Notice } from '@/components/Notice';
import { useSession } from '@/session/sessionContext';
import styles from './SettingsPage.module.css';

const MIN_LENGTH = 8;

export function PasswordPanel() {
  const { updatePassword } = useSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage({ tone: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }
    updatePassword(password).then(
      () => {
        setPassword('');
        setConfirmation('');
        setMessage({ tone: 'success', text: 'Contraseña actualizada.' });
      },
      () => {
        setMessage({ tone: 'error', text: 'No se pudo cambiar la contraseña.' });
      },
    );
  };

  return (
    <section className={styles.import} aria-labelledby="password-title">
      <h2 id="password-title" className={styles.importTitle}>
        Cambiar contraseña
      </h2>
      <form className={styles.passwordForm} onSubmit={submit}>
        <label>
          <span>Nueva contraseña</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />
        </label>
        <label>
          <span>Repite la contraseña</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
            }}
          />
        </label>
        <div className={styles.actions}>
          <button type="submit" className="button">
            Guardar contraseña
          </button>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
        </div>
      </form>
    </section>
  );
}
