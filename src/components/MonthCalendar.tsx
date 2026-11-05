import { useState } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { listDraftDates } from '@/data/draftStore';
import { dayStatus } from '@/domain/csv/exportCsv';
import {
  dayOfMonth,
  formatLongDate,
  formatMonth,
  isValidIsoDate,
  monthGrid,
  shiftMonth,
  today,
} from '@/domain/dates';
import type { IsoDate } from '@/domain/types';
import { useLogbook } from '@/state/logbookContext';
import styles from './MonthCalendar.module.css';
import { STATUS_LABELS } from './StatusBadge';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function Month({ selected }: { selected: IsoDate | null }) {
  const { days, getDay, settings, draftScope } = useLogbook();
  const [month, setMonth] = useState(selected ?? today());
  const savedDates = new Set(days.map((day) => day.date));
  const draftDates = new Set(listDraftDates(draftScope));
  const currentDay = today();

  return (
    <section aria-label="Calendario">
      <div className={styles.header}>
        <button
          type="button"
          className="icon-button"
          aria-label="Mes anterior"
          onClick={() => {
            setMonth((value) => shiftMonth(value, -1));
          }}
        >
          ‹
        </button>
        <span className={styles.month}>{formatMonth(month)}</span>
        <button
          type="button"
          className="icon-button"
          aria-label="Mes siguiente"
          onClick={() => {
            setMonth((value) => shiftMonth(value, 1));
          }}
        >
          ›
        </button>
      </div>
      <div className={styles.grid}>
        {WEEKDAYS.map((label, index) => (
          <span key={index} className={styles.weekday} aria-hidden="true">
            {label}
          </span>
        ))}
        {monthGrid(month).map((date) => {
          const status = dayStatus(savedDates.has(date) ? getDay(date) : undefined, settings);
          const hasDraft = draftDates.has(date);
          const classes = [
            styles.day,
            styles[status],
            date.slice(0, 7) === month.slice(0, 7) ? '' : styles.outside,
            date === currentDay ? styles.today : '',
            date === selected ? styles.selected : '',
            hasDraft ? styles.hasDraft : '',
          ];
          const detail = hasDraft
            ? `${STATUS_LABELS[status]}, notas sin agregar`
            : STATUS_LABELS[status];
          return (
            <Link
              key={date}
              to={`/dia/${date}`}
              className={classes.filter(Boolean).join(' ')}
              aria-label={`${formatLongDate(date)}: ${detail}`}
              aria-current={date === selected ? 'date' : undefined}
              title={detail}
            >
              {dayOfMonth(date)}
            </Link>
          );
        })}
      </div>
      <ul className={styles.legend}>
        <li className={styles.legendDraft}>Por exportar</li>
        <li className={styles.legendExported}>Exportado</li>
        <li className={styles.legendNotes}>Notas sin agregar</li>
      </ul>
    </section>
  );
}

export function MonthCalendar() {
  const match = useMatch('/dia/:date');
  const date = match?.params.date ?? '';
  const selected = isValidIsoDate(date) ? date : null;
  return <Month key={selected?.slice(0, 7) ?? 'today'} selected={selected} />;
}
