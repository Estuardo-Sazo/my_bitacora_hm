import { useSession } from '@/session/sessionContext';
import styles from './LoginScreen.module.css';

interface Props {
  email: string;
  userId: string;
}

export function AccessDenied({ email, userId }: Props) {
  const { signOut, enterDemo } = useSession();

  return (
    <main className={styles.page}>
      <section className={styles.intro}>
        <h1 className={styles.title}>Sin acceso</h1>
        <p className={styles.lead}>
          La cuenta {email} no tiene acceso a esta bitácora, que es privada. Puedes probar la app
          con datos ficticios.
        </p>
        <p className={styles.hint}>
          ¿Es tu cuenta? Autorízala con este ID: <code className="mono">{userId}</code>
        </p>
        <div className={styles.actions}>
          <button type="button" className="button button-primary" onClick={enterDemo}>
            Probar la demo
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              void signOut();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </section>
    </main>
  );
}
