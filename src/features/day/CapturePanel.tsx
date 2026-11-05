import { useMemo, useRef, useState } from 'react';
import { readDraft, writeDraft } from '@/data/draftStore';
import { parseNotes } from '@/domain/parser';
import type { LineHint, ParsedLine } from '@/domain/parser';
import { formatHours } from '@/domain/time';
import type { DayLog, PendingItem } from '@/domain/types';
import { useLogbook } from '@/state/logbookContext';
import styles from './CapturePanel.module.css';
import { PendingPanel } from './PendingPanel';

const PLACEHOLDER = `1204 1h
1207 2h planilla
no plan 2h core apoyo a producción
apoyo revisar correo que no llega`;

const createId = () => crypto.randomUUID();

function hintText(hint: LineHint): string {
  switch (hint.type) {
    case 'moduleCorrected':
      return `“${hint.from}” → ${hint.to}`;
    case 'moduleFromHistory':
      return `módulo del historial`;
    case 'missingModule':
      return 'falta módulo';
    case 'missingDuration':
      return 'faltan horas';
  }
}

function PreviewLine({ line }: { line: ParsedLine }) {
  if (line.type === 'ignored') return null;
  if (line.type === 'pending') {
    return (
      <li className={styles.previewLine}>
        <span className={styles.previewKind}>Pendiente</span>
        <span>{line.text}</span>
      </li>
    );
  }
  const { entry, hints } = line;
  const needsAttention = hints.some(
    (hint) => hint.type === 'missingModule' || hint.type === 'missingDuration',
  );
  return (
    <li className={styles.previewLine}>
      <span className={`${styles.previewKind} mono`}>{entry.activity}</span>
      <span>
        {entry.durationMinutes > 0 && (
          <span className="mono">{formatHours(entry.durationMinutes)} </span>
        )}
        {entry.module}
        {hints.length > 0 && (
          <span className={needsAttention ? styles.hintAlert : styles.hint}>
            {' '}
            {hints.map(hintText).join(' · ')}
          </span>
        )}
      </span>
    </li>
  );
}

export function CapturePanel({ day }: { day: DayLog }) {
  const { settings, ticketModules, draftScope, saveDay, addPending, removePending } = useLogbook();
  const [text, setText] = useState(() => readDraft(draftScope, day.date));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lines = useMemo(
    () => parseNotes(text, { settings, ticketModules, createId }),
    [text, settings, ticketModules],
  );
  const usableLines = lines.filter((line) => line.type !== 'ignored');

  const updateText = (value: string) => {
    setText(value);
    writeDraft(draftScope, day.date, value);
  };

  const apply = () => {
    const entries = lines.flatMap((line) => (line.type === 'entry' ? [line.entry] : []));
    const pending: PendingItem[] = lines.flatMap((line) =>
      line.type === 'pending'
        ? [{ id: createId(), text: line.text, date: day.date, createdAt: new Date().toISOString() }]
        : [],
    );

    if (entries.length > 0) saveDay({ ...day, entries: [...day.entries, ...entries] });
    if (pending.length > 0) addPending(pending);
    updateText('');
    textareaRef.current?.focus();
  };

  const registerPending = (item: PendingItem) => {
    const separator = text && !text.endsWith('\n') ? '\n' : '';
    updateText(`${text}${separator}no plan  ${item.text}`);
    removePending([item.id]);
    textareaRef.current?.focus();
  };

  return (
    <section className={styles.panel} aria-labelledby="capture-title">
      <h2 id="capture-title" className="section-title">
        Anota lo que hiciste
      </h2>
      <textarea
        ref={textareaRef}
        className={`${styles.input} mono`}
        aria-labelledby="capture-title"
        aria-describedby="capture-help"
        placeholder={PLACEHOLDER}
        rows={7}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={text}
        onChange={(event) => {
          updateText(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && usableLines.length > 0) {
            event.preventDefault();
            apply();
          }
        }}
      />

      {usableLines.length > 0 && (
        <ol className={styles.preview} aria-label="Vista previa">
          {lines.map((line, index) => (
            <PreviewLine key={index} line={line} />
          ))}
        </ol>
      )}

      <div className={styles.footer}>
        <button
          type="button"
          className="button button-primary"
          disabled={usableLines.length === 0}
          onClick={apply}
        >
          Agregar al día
        </button>
        <span id="capture-help" className={styles.help}>
          {text.trim()
            ? 'Guardado en este navegador. Puedes cerrar y seguir después.'
            : 'Una línea por actividad.'}
        </span>
      </div>

      <details className={styles.guide}>
        <summary>Cómo escribir</summary>
        <dl>
          <dt className="mono">1204 1.5h notas</dt>
          <dd>Ticket, horas y módulo. El módulo es opcional si el ticket ya existe.</dd>
          <dt className="mono">no plan 2h core detalle</dt>
          <dd>Trabajo sin ticket. El detalle queda como nota privada.</dd>
          <dt className="mono">reunion cliente 1h</dt>
          <dd>Reunión, con o sin “cliente”.</dd>
          <dt className="mono">apoyo revisar correo</dt>
          <dd>Sin horas queda pendiente para registrarlo después.</dd>
        </dl>
      </details>

      <PendingPanel onRegister={registerPending} />
    </section>
  );
}
