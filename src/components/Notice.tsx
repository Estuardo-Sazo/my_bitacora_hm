import type { ReactNode } from 'react';
import styles from './Notice.module.css';

interface Props {
  tone: 'error' | 'warning' | 'success';
  children: ReactNode;
}

export function Notice({ tone, children }: Props) {
  return (
    <p className={`${styles.notice} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
