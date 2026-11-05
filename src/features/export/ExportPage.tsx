import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Notice } from '@/components/Notice';
import { StatusBadge } from '@/components/StatusBadge';
import { listDraftDates } from '@/data/draftStore';
import {
  buildCsvFile,
  buildCsvText,
  buildFileName,
  dayStatus,
  markExported,
} from '@/domain/csv/exportCsv';
import { formatLongDate, today } from '@/domain/dates';
import { workedMinutes } from '@/domain/scheduler';
import { countDays, formatHours } from '@/domain/time';
import type { DayLog, IsoDate } from '@/domain/types';
import { hasBlockingIssues, validateDay } from '@/domain/validation';
import { useLogbook } from '@/state/logbookContext';
import { saveFile } from './saveFile';
import styles from './ExportPage.module.css';

const RECENT_EXPORTED_DAYS = 15;

export function ExportPage() {
  const { days, settings, draftScope, saveDays } = useLogbook();
  const draftDates = listDraftDates(draftScope);
  /** Dates the user toggled away from the default selection. */
  const [toggled, setToggled] = useState<ReadonlySet<IsoDate>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const items = useMemo(
    () =>
      days
        .map((day) => {
          const status = dayStatus(day, settings);
          const issues = validateDay(day, settings);
          return { day, status, blocked: hasBlockingIssues(issues), warnings: issues.length };
        })
        .filter(({ status }) => status !== 'empty' && status !== 'off')
        .sort((a, b) => b.day.date.localeCompare(a.day.date)),
    [days, settings],
  );

  const pending = items.filter(({ status }) => status === 'draft' || status === 'modified');
  const exported = items
    .filter(({ status }) => status === 'exported')
    .slice(0, RECENT_EXPORTED_DAYS);
  const visible = [...pending, ...exported];

  const isSelected = (item: (typeof items)[number]): boolean => {
    if (item.blocked) return false;
    const selectedByDefault = item.status !== 'exported';
    return toggled.has(item.day.date) ? !selectedByDefault : selectedByDefault;
  };

  const selected: DayLog[] = visible.filter(isSelected).map(({ day }) => day);
  const repeats = visible.filter((item) => isSelected(item) && item.status === 'exported').length;
  const preview = selected.length > 0 ? buildCsvText(selected, settings) : '';

  const toggle = (date: IsoDate) => {
    setResult(null);
    setToggled((current) => {
      const next = new Set(current);
      if (!next.delete(date)) next.add(date);
      return next;
    });
  };

  const handleExport = async () => {
    const { bytes, unmappable } = buildCsvFile(selected, settings);
    const exportedAt = new Date().toISOString();
    const fileName = buildFileName(settings.exportFilePrefix, today());
    setFailed(false);
    if (!(await saveFile(bytes, fileName))) return;
    try {
      await saveDays(selected.map((day) => markExported(day, settings, exportedAt)));
      setToggled(new Set());
      const replaced =
        unmappable.length > 0 ? ` Se reemplazó “${unmappable.join(' ')}” por “?”.` : '';
      setResult(`${fileName} listo con ${countDays(selected.length)}.${replaced}`);
    } catch {
      setFailed(true);
    }
  };

  const renderItem = (item: (typeof items)[number]) => (
    <li key={item.day.date} className={styles.item}>
      <label className={styles.choice}>
        <input
          type="checkbox"
          checked={isSelected(item)}
          disabled={item.blocked}
          onChange={() => {
            toggle(item.day.date);
          }}
        />
        <span className={styles.date}>{formatLongDate(item.day.date)}</span>
      </label>
      <span className="mono">{formatHours(workedMinutes(item.day))}</span>
      <StatusBadge status={item.status} />
      {item.blocked ? (
        <Link className={styles.fix} to={`/dia/${item.day.date}`}>
          Corregir
        </Link>
      ) : (
        <Link className={styles.open} to={`/dia/${item.day.date}`}>
          Abrir
        </Link>
      )}
    </li>
  );

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Exportar</h1>
        {draftDates.length > 0 && (
          <div className={styles.drafts}>
            <Notice tone="warning">Tienes notas sin agregar al día:</Notice>
            <ul>
              {draftDates.map((date) => (
                <li key={date}>
                  <Link to={`/dia/${date}`}>{formatLongDate(date)}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {pending.length > 0 ? (
          <>
            <h2 className="section-title">Por exportar</h2>
            <ul className={styles.list}>{pending.map(renderItem)}</ul>
          </>
        ) : (
          <p className={styles.allDone}>No tienes días pendientes de exportar.</p>
        )}
        {exported.length > 0 && (
          <details className={styles.exported}>
            <summary>Ya exportados ({exported.length})</summary>
            <ul className={styles.list}>{exported.map(renderItem)}</ul>
          </details>
        )}
      </div>

      <aside className={styles.side} aria-labelledby="csv-preview">
        {repeats > 0 && (
          <Notice tone="warning">
            {repeats === 1
              ? 'Un día seleccionado ya se exportó. '
              : `${repeats} días seleccionados ya se exportaron. `}
            Importarlos otra vez podría duplicarlos.
          </Notice>
        )}
        <button
          type="button"
          className="button button-primary"
          disabled={selected.length === 0}
          onClick={() => {
            void handleExport();
          }}
        >
          Descargar CSV ({countDays(selected.length)})
        </button>
        {result && <Notice tone="success">{result}</Notice>}
        {failed && (
          <Notice tone="error">
            El archivo se descargó, pero no se pudo marcar como exportado.
          </Notice>
        )}
        <h2 id="csv-preview" className="section-title">
          Vista previa del CSV
        </h2>
        <pre className={`${styles.preview} mono`} tabIndex={0}>
          {preview || 'Selecciona al menos un día.'}
        </pre>
      </aside>
    </div>
  );
}
