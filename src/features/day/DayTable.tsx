import { Fragment, useState } from 'react';
import { CommitInput } from '@/components/CommitInput';
import { scheduleDay } from '@/domain/scheduler';
import { formatClock, formatHours, parseClock, parseDuration } from '@/domain/time';
import type { DayLog, ScheduledRow, WorkEntry } from '@/domain/types';
import { validateDay } from '@/domain/validation';
import { useLogbook } from '@/state/logbookContext';
import styles from './DayTable.module.css';
import { EntryDialog } from './EntryDialog';

interface RowProps {
  index: number;
  entry: WorkEntry;
  row: ScheduledRow;
  hasError: boolean;
  isLast: boolean;
  onChange: (entry: WorkEntry) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

function EntryRow({ index, entry, row, hasError, isLast, onChange, onMove, onRemove }: RowProps) {
  const [expanded, setExpanded] = useState(false);
  const name = entry.activity || 'actividad';
  const fixedStart = entry.fixedStartMinutes === null ? '' : formatClock(entry.fixedStartMinutes);
  const hours = entry.durationMinutes > 0 ? formatHours(entry.durationMinutes) : '';

  return (
    <>
      <tr className={hasError ? `${styles.entryRow} ${styles.rowError}` : styles.entryRow}>
        <td className={styles.rowNumber}>{index + 1}</td>
        <td className={`${styles.time} mono`}>
          {formatClock(row.startMinutes)}–{formatClock(row.endMinutes)}
        </td>
        <td data-label="Actividad">
          <CommitInput
            key={entry.activity}
            className="mono"
            aria-label="Actividad"
            value={entry.activity}
            onCommit={(activity) => {
              onChange({ ...entry, activity: activity.trim() });
              return true;
            }}
          />
        </td>
        <td data-label="Módulo">
          <CommitInput
            key={entry.module}
            aria-label={`Módulo de ${name}`}
            list="module-catalog"
            aria-invalid={entry.kind !== 'meeting' && !entry.module}
            value={entry.module}
            onCommit={(module) => {
              onChange({ ...entry, module: module.trim() });
              return true;
            }}
          />
        </td>
        <td data-label="Horas">
          <CommitInput
            key={hours}
            className={`${styles.hours} mono`}
            aria-label={`Horas de ${name}`}
            aria-invalid={entry.durationMinutes <= 0}
            value={hours}
            onCommit={(value) => {
              const durationMinutes = parseDuration(value);
              if (durationMinutes === null) return false;
              onChange({ ...entry, durationMinutes });
              return true;
            }}
          />
        </td>
        <td data-label="Descripción">
          <CommitInput
            key={entry.note}
            aria-label={`Descripción de ${name}`}
            value={entry.note}
            onCommit={(note) => {
              onChange({ ...entry, note });
              return true;
            }}
          />
        </td>
        <td className={styles.actions}>
          <button
            type="button"
            className="icon-button"
            aria-label={`Subir ${name}`}
            disabled={index === 0}
            onClick={() => {
              onMove(-1);
            }}
          >
            ↑
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Bajar ${name}`}
            disabled={isLast}
            onClick={() => {
              onMove(1);
            }}
          >
            ↓
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Más campos de ${name}`}
            aria-expanded={expanded}
            onClick={() => {
              setExpanded((value) => !value);
            }}
          >
            ⋯
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Eliminar ${name}`}
            onClick={onRemove}
          >
            ×
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className={styles.detailRow}>
          <td colSpan={7}>
            <div className={styles.details}>
              <label>
                <span>Categoría</span>
                <CommitInput
                  key={entry.category}
                  value={entry.category}
                  onCommit={(category) => {
                    onChange({ ...entry, category: category.trim() });
                    return true;
                  }}
                />
              </label>
              <label>
                <span>Solicitado por</span>
                <CommitInput
                  key={entry.requestedBy}
                  value={entry.requestedBy}
                  onCommit={(requestedBy) => {
                    onChange({ ...entry, requestedBy: requestedBy.trim() });
                    return true;
                  }}
                />
              </label>
              <label>
                <span>Hora fija</span>
                <CommitInput
                  key={fixedStart}
                  className="mono"
                  type="time"
                  value={fixedStart}
                  onCommit={(value) => {
                    if (!value.trim()) {
                      onChange({ ...entry, fixedStartMinutes: null });
                      return true;
                    }
                    const fixedStartMinutes = parseClock(value);
                    if (fixedStartMinutes === null) return false;
                    onChange({ ...entry, fixedStartMinutes });
                    return true;
                  }}
                />
              </label>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function DayTable({ day }: { day: DayLog }) {
  const { settings, saveDay } = useLogbook();
  const [adding, setAdding] = useState(false);

  if (day.dayType === 'off') {
    return <p className={styles.message}>Día libre: no se exporta ninguna fila.</p>;
  }

  const rows = scheduleDay(day, settings);
  const dailyRow = rows.find((row) => row.entryId === null);
  const workRows = new Map(rows.flatMap((row) => (row.entryId ? [[row.entryId, row]] : [])));
  const issues = validateDay(day, settings);
  const entriesWithErrors = new Set(
    issues.filter((issue) => issue.severity === 'error').map((issue) => issue.entryId),
  );

  const replaceEntries = (entries: WorkEntry[]) => {
    saveDay({ ...day, entries });
  };

  const moveEntry = (index: number, direction: -1 | 1) => {
    const entries = [...day.entries];
    const [moved] = entries.splice(index, 1);
    if (moved) entries.splice(index + direction, 0, moved);
    replaceEntries(entries);
  };

  return (
    <section className={styles.section} aria-label="Actividades del día">
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.rowNumber} aria-label="Fila" />
              <th className={styles.colTime}>Horario</th>
              <th className={styles.colActivity}>Actividad</th>
              <th className={styles.colModule}>Módulo</th>
              <th className={styles.colHours}>Horas</th>
              <th>Descripción</th>
              <th className={styles.colActions} aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {dailyRow && (
              <tr className={styles.autoRow}>
                <td className={styles.rowNumber} />
                <td className={`${styles.time} mono`}>
                  {formatClock(dailyRow.startMinutes)}–{formatClock(dailyRow.endMinutes)}
                </td>
                <td className={styles.plain}>{dailyRow.activity}</td>
                <td className={styles.plain} colSpan={4}>
                  Automático · {dailyRow.requestedBy}
                </td>
              </tr>
            )}
            {day.entries.map((entry, index) => {
              const row = workRows.get(entry.id);
              if (!row) return null;
              const previous = workRows.get(day.entries[index - 1]?.id ?? '');
              const hasLunchGap = previous !== undefined && row.startMinutes > previous.endMinutes;
              return (
                <Fragment key={entry.id}>
                  {hasLunchGap && (
                    <tr className={styles.lunchRow}>
                      <td className={styles.rowNumber} />
                      <td className={`${styles.time} mono`}>
                        {formatClock(previous.endMinutes)}–{formatClock(row.startMinutes)}
                      </td>
                      <td className={styles.plain} colSpan={5}>
                        Almuerzo
                      </td>
                    </tr>
                  )}
                  <EntryRow
                    index={index}
                    entry={entry}
                    row={row}
                    hasError={entriesWithErrors.has(entry.id)}
                    isLast={index === day.entries.length - 1}
                    onChange={(updated) => {
                      replaceEntries(
                        day.entries.map((item) => (item.id === entry.id ? updated : item)),
                      );
                    }}
                    onMove={(direction) => {
                      moveEntry(index, direction);
                    }}
                    onRemove={() => {
                      replaceEntries(day.entries.filter((item) => item.id !== entry.id));
                    }}
                  />
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.below}>
        <button
          type="button"
          className={`button ${styles.addButton}`}
          onClick={() => {
            setAdding(true);
          }}
        >
          + Agregar actividad
        </button>
        {issues.length > 0 && (
          <ul className={styles.issues} aria-label="Revisiones del día">
            {issues.map((issue, index) => (
              <li
                key={`${issue.code}-${index}`}
                className={issue.severity === 'error' ? styles.issueError : styles.issueWarning}
              >
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <datalist id="module-catalog">
        {settings.modules.map((module) => (
          <option key={module} value={module} />
        ))}
      </datalist>

      {adding && (
        <EntryDialog
          onAdd={(entry) => {
            replaceEntries([...day.entries, entry]);
          }}
          onClose={() => {
            setAdding(false);
          }}
        />
      )}
    </section>
  );
}
