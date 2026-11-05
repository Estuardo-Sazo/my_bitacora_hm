import { Link } from 'react-router-dom';
import type { PendingItem } from '@/domain/types';
import { useLogbook } from '@/state/logbookContext';
import styles from './PendingPanel.module.css';

interface Props {
  onRegister: (item: PendingItem) => void;
}

export function PendingPanel({ onRegister }: Props) {
  const { pending, removePending } = useLogbook();
  if (pending.length === 0) return null;

  return (
    <section className={styles.panel} aria-labelledby="pending-title">
      <h2 id="pending-title" className="section-title">
        Pendientes ({pending.length})
      </h2>
      <ul className={styles.list}>
        {pending.map((item) => (
          <li key={item.id} className={styles.item}>
            <span className={styles.text}>
              {item.text}
              <Link className={`${styles.date} mono`} to={`/dia/${item.date}`}>
                {item.date.slice(8)}/{item.date.slice(5, 7)}
              </Link>
            </span>
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                onRegister(item);
              }}
            >
              Registrar
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Quitar pendiente: ${item.text}`}
              onClick={() => {
                removePending([item.id]);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
