import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CommitInput } from '@/components/CommitInput';
import { StatusBadge } from '@/components/StatusBadge';
import { dayStatus } from '@/domain/csv/exportCsv';
import { addDays, formatLongDate, isValidIsoDate } from '@/domain/dates';
import { expectedMinutes, workedMinutes } from '@/domain/scheduler';
import { formatClock, formatHours, parseClock } from '@/domain/time';
import type { DayLog, DayType } from '@/domain/types';
import { useLogbook } from '@/state/logbookContext';
import styles from './DayHeader.module.css';

export function DayHeader({ day }: { day: DayLog }) {
  const { saveDay, settings } = useLogbook();
  const navigate = useNavigate();
  const [controlsOpen, setControlsOpen] = useState(false);
  const start = formatClock(day.startMinutes ?? settings.workdayStartMinutes);
  const worked = workedMinutes(day);
  const expected = expectedMinutes(day, settings);

  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <Link
          className="icon-button"
          to={`/dia/${addDays(day.date, -1)}`}
          aria-label="Día anterior"
        >
          ‹
        </Link>
        <Link
          className="icon-button"
          to={`/dia/${addDays(day.date, 1)}`}
          aria-label="Día siguiente"
        >
          ›
        </Link>
        <h1 className={styles.date}>{formatLongDate(day.date)}</h1>
        <StatusBadge status={dayStatus(day, settings)} />
      </div>

      <div className={styles.meta}>
        {day.dayType !== 'off' && (
          <p className={worked === expected ? styles.totalOk : styles.total}>
            {formatHours(worked)} de {formatHours(expected)}
          </p>
        )}
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={controlsOpen}
          onClick={() => {
            setControlsOpen((open) => !open);
          }}
        >
          Ajustar día
        </button>
      </div>

      <div className={controlsOpen ? `${styles.controls} ${styles.open}` : styles.controls}>
        <input
          className={styles.datePicker}
          type="date"
          aria-label="Ir a la fecha"
          value={day.date}
          onChange={(event) => {
            if (isValidIsoDate(event.target.value)) void navigate(`/dia/${event.target.value}`);
          }}
        />

        <label className={styles.field}>
          <span>Jornada</span>
          <select
            value={day.dayType}
            onChange={(event) => {
              saveDay({ ...day, dayType: event.target.value as DayType });
            }}
          >
            <option value="full">Completa</option>
            <option value="half">Media</option>
            <option value="off">Libre</option>
          </select>
        </label>
        {day.dayType !== 'off' && (
          <>
            <label className={styles.field}>
              <span>Inicio</span>
              <CommitInput
                key={start}
                className={`${styles.time} mono`}
                type="time"
                value={start}
                onCommit={(value) => {
                  const minutes = parseClock(value);
                  if (minutes === null) return false;
                  const usual = minutes === settings.workdayStartMinutes;
                  saveDay({ ...day, startMinutes: usual ? null : minutes });
                  return true;
                }}
              />
            </label>
            <label className={styles.field}>
              <input
                type="checkbox"
                checked={day.includeDaily}
                onChange={(event) => {
                  saveDay({ ...day, includeDaily: event.target.checked });
                }}
              />
              <span>{settings.daily.label}</span>
            </label>
          </>
        )}
      </div>
    </header>
  );
}
