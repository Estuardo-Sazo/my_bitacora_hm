import { useState } from 'react';
import { Notice } from '@/components/Notice';
import { isGoogleEnabled, isSupabaseConfigured } from '@/data/supabaseConfig';
import { useSession } from '@/session/sessionContext';
import { EmailSignIn } from './EmailSignIn';
import styles from './LoginScreen.module.css';

const SAMPLE_NOTES = `1204 2h facturas
1207 3 inventario
no plan 1h core soporte
1190 2h`;

const SAMPLE_ROWS = [
  ['08:30', '09:00', 'Daily Scrum'],
  ['08:00', '10:00', '1204 · Facturas'],
  ['10:00', '13:00', '1207 · Inventario'],
  ['14:00', '15:00', 'No plan · Core'],
  ['15:00', '17:00', '1190 · Reportes'],
];

export function LoginScreen() {
  const { signInWithGoogle, enterDemo } = useSession();
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = () => {
    setError(null);
    signInWithGoogle().catch(() => {
      setError('No se pudo iniciar sesión. Inténtalo de nuevo.');
    });
  };

  return (
    <main className={styles.page}>
      <section className={styles.intro}>
        <h1 className={styles.title}>Bitácora</h1>
        <p className={styles.lead}>
          Escribe lo que hiciste como lo anotarías en un papel. La app calcula los horarios, agrega
          el Daily y genera el CSV listo para importar.
        </p>
        {isSupabaseConfigured && <EmailSignIn />}
        <div className={styles.actions}>
          {isSupabaseConfigured && isGoogleEnabled && (
            <button type="button" className="button" onClick={handleGoogle}>
              Entrar con Google
            </button>
          )}
          <button type="button" className="button" onClick={enterDemo}>
            Probar la demo
          </button>
        </div>
        <p className={styles.hint}>
          {isSupabaseConfigured
            ? 'La bitácora es privada. La demo usa datos ficticios guardados solo en tu navegador.'
            : 'El inicio de sesión no está configurado en este entorno. La demo funciona igual.'}
        </p>
        {error && <Notice tone="error">{error}</Notice>}
      </section>

      <section className={styles.sample} aria-label="Ejemplo de notas convertidas en bitácora">
        <div>
          <p className="section-title">Lo que escribes</p>
          <pre className={`${styles.notes} mono`}>{SAMPLE_NOTES}</pre>
        </div>
        <div>
          <p className="section-title">Lo que obtienes</p>
          <ol className={styles.rows}>
            {SAMPLE_ROWS.map(([start, end, label]) => (
              <li key={label} className={styles.row}>
                <span className="mono">
                  {start}–{end}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
