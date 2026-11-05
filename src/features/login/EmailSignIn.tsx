import type { FormEvent } from 'react';
import { useState } from 'react';
import { Notice } from '@/components/Notice';
import { useSession } from '@/session/sessionContext';
import styles from './LoginScreen.module.css';

/**
 * The code matters on phones: a link opens in the mail app's browser, while a typed code signs in
 * right here, including inside the installed app.
 */
export function EmailSignIn() {
  const { sendEmailCode, verifyEmailCode } = useSession();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await sendEmailCode(email.trim());
      setCodeSent(true);
    }, 'No se pudo enviar el correo. Revisa la dirección o inténtalo en un minuto.');
  };

  const verifyCode = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () => verifyEmailCode(email.trim(), code.trim()),
      'El código no es válido o ya venció.',
    );
  };

  if (codeSent) {
    return (
      <form className={styles.form} onSubmit={verifyCode}>
        <p className={styles.hint}>
          Enviamos un correo a {email}. Escribe el código o abre el enlace en este navegador.
        </p>
        <label>
          <span>Código</span>
          <input
            className="mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
            }}
          />
        </label>
        <div className={styles.actions}>
          <button type="submit" className="button button-primary" disabled={busy}>
            Entrar
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              setCodeSent(false);
              setCode('');
              setError(null);
            }}
          >
            Cambiar correo
          </button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={sendCode}>
      <label>
        <span>Correo</span>
        <input
          type="email"
          autoComplete="email"
          autoCapitalize="off"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      </label>
      <div className={styles.actions}>
        <button type="submit" className="button button-primary" disabled={busy}>
          Enviar código
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </form>
  );
}
