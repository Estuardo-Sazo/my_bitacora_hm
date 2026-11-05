import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { buildManualEntry, entryDefaults } from '@/domain/manualEntry';
import type { ManualEntryField } from '@/domain/manualEntry';
import type { EntryKind, WorkEntry } from '@/domain/types';
import { useLogbook } from '@/state/logbookContext';
import styles from './EntryDialog.module.css';

interface Props {
  onAdd: (entry: WorkEntry) => void;
  onClose: () => void;
}

const EMPTY_FORM = {
  ticket: '',
  hours: '',
  module: '',
  description: '',
  category: '',
  requestedBy: '',
};

export function EntryDialog({ onAdd, onClose }: Props) {
  const { settings, ticketModules } = useLogbook();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<EntryKind>('ticket');
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<ManualEntryField, string>>>({});
  const historyModule = kind === 'ticket' ? ticketModules.get(form.ticket.trim()) : undefined;
  const defaults = entryDefaults(kind, settings);

  useEffect(() => {
    dialogRef.current?.showModal();
    firstFieldRef.current?.focus();
  }, []);

  const update = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const result = buildManualEntry(
      { kind, ...form },
      { settings, ticketModules, createId: () => crypto.randomUUID() },
    );
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onAdd(result.entry);
    if (submitter?.value === 'another') {
      setForm(EMPTY_FORM);
      setErrors({});
      firstFieldRef.current?.focus();
    } else {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="entry-title"
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <h2 id="entry-title" className={styles.title}>
          Agregar actividad
        </h2>

        <div className={styles.fields}>
          <label className={styles.wide}>
            <span>Tipo</span>
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as EntryKind);
                setErrors({});
              }}
            >
              <option value="ticket">Ticket</option>
              <option value="noPlan">Sin ticket ({settings.noPlanLabel})</option>
              <option value="meeting">Reunión</option>
            </select>
          </label>

          {kind === 'ticket' && (
            <label>
              <span>Ticket</span>
              <input
                ref={firstFieldRef}
                className="mono"
                inputMode="numeric"
                enterKeyHint="next"
                autoComplete="off"
                value={form.ticket}
                aria-invalid={Boolean(errors.ticket)}
                onChange={(event) => {
                  update('ticket', event.target.value);
                }}
              />
              {errors.ticket && <em className={styles.error}>{errors.ticket}</em>}
            </label>
          )}

          <label>
            <span>Tiempo</span>
            <input
              className="mono"
              placeholder="1.5h"
              autoComplete="off"
              value={form.hours}
              aria-invalid={Boolean(errors.hours)}
              onChange={(event) => {
                update('hours', event.target.value);
              }}
            />
            {errors.hours && <em className={styles.error}>{errors.hours}</em>}
          </label>

          <label className={styles.wide}>
            <span>Módulo{kind === 'meeting' && ' (opcional)'}</span>
            <input
              list="module-catalog"
              autoComplete="off"
              placeholder={historyModule ? `${historyModule} (del historial)` : undefined}
              value={form.module}
              aria-invalid={Boolean(errors.module)}
              onChange={(event) => {
                update('module', event.target.value);
              }}
            />
            {errors.module && <em className={styles.error}>{errors.module}</em>}
          </label>

          <label className={styles.wide}>
            <span>Descripción (no se exporta)</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => {
                update('description', event.target.value);
              }}
            />
          </label>
        </div>

        <details className={styles.more}>
          <summary>
            {form.category.trim() || defaults.category} ·{' '}
            {form.requestedBy.trim() || defaults.requestedBy}
          </summary>
          <div className={styles.fields}>
            <label>
              <span>Categoría</span>
              <input
                autoComplete="off"
                placeholder={defaults.category}
                value={form.category}
                onChange={(event) => {
                  update('category', event.target.value);
                }}
              />
            </label>
            <label>
              <span>Solicitado por</span>
              <input
                autoComplete="off"
                placeholder={defaults.requestedBy}
                value={form.requestedBy}
                onChange={(event) => {
                  update('requestedBy', event.target.value);
                }}
              />
            </label>
          </div>
        </details>

        <div className={styles.actions}>
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button" value="another">
            Agregar y seguir
          </button>
          <button type="submit" className="button button-primary" value="close">
            Agregar
          </button>
        </div>
      </form>
    </dialog>
  );
}
