import type { DayStatus } from '@/domain/types';
import styles from './StatusBadge.module.css';

export const STATUS_LABELS: Readonly<Record<DayStatus, string>> = {
  empty: 'Sin registros',
  off: 'Día libre',
  draft: 'Por exportar',
  exported: 'Exportado',
  modified: 'Cambió tras exportar',
};

export function StatusBadge({ status }: { status: DayStatus }) {
  return <span className={`${styles.badge} ${styles[status]}`}>{STATUS_LABELS[status]}</span>;
}
