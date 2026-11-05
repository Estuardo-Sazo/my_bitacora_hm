import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { today } from '@/domain/dates';
import { useSession } from '@/session/sessionContext';
import { useLogbook } from '@/state/logbookContext';
import styles from './AppShell.module.css';
import { MonthCalendar } from './MonthCalendar';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.link} ${styles.active}` : styles.link;

export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut, exitDemo } = useSession();
  const { unsyncedChanges } = useLogbook();
  const isDemo = session.status === 'demo';

  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <div className={styles.brand}>Bitácora{isDemo && <small> demo</small>}</div>
        <nav className={styles.nav} aria-label="Principal">
          <NavLink to={`/dia/${today()}`} className={linkClass}>
            Hoy
          </NavLink>
          <NavLink to="/exportar" className={linkClass}>
            Exportar
          </NavLink>
          <NavLink to="/ajustes" className={linkClass}>
            Ajustes
          </NavLink>
        </nav>
        <div className={styles.calendar}>
          <MonthCalendar />
        </div>
        <div className={styles.account}>
          {session.status === 'ready' && (
            <span title={session.user.email}>{session.user.name}</span>
          )}
          <button
            type="button"
            className={styles.exit}
            onClick={() => {
              if (isDemo) exitDemo();
              else void signOut();
            }}
          >
            {isDemo ? 'Salir de la demo' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
      <main className={styles.main}>
        {unsyncedChanges > 0 && (
          <p className={styles.sync} role="status">
            Guardado en este dispositivo. Se sincronizará al recuperar la conexión.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
