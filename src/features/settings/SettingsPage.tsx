import type { FormEvent } from 'react';
import { useState } from 'react';
import { Notice } from '@/components/Notice';
import { formatClock, parseClock } from '@/domain/time';
import type { Settings } from '@/domain/types';
import { useSession } from '@/session/sessionContext';
import { useLogbook } from '@/state/logbookContext';
import { ImportPanel } from './ImportPanel';
import styles from './SettingsPage.module.css';

const CLOCK_FIELDS = {
  workdayStartMinutes: 'Entrada',
  workdayEndMinutes: 'Salida',
  lunchStartMinutes: 'Almuerzo desde',
} as const;

type ClockField = keyof typeof CLOCK_FIELDS;

function readForm(form: HTMLFormElement, settings: Settings): Settings | null {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? '').trim();
  const clock = (name: string) => parseClock(text(name));

  const times = Object.keys(CLOCK_FIELDS).map((key) => clock(key));
  const dailyStart = clock('dailyStart');
  if (times.includes(null) || dailyStart === null) return null;

  return {
    ...settings,
    workdayStartMinutes: clock('workdayStartMinutes') ?? settings.workdayStartMinutes,
    workdayEndMinutes: clock('workdayEndMinutes') ?? settings.workdayEndMinutes,
    lunchStartMinutes: clock('lunchStartMinutes') ?? settings.lunchStartMinutes,
    lunchDurationMinutes: Number(text('lunchDuration')),
    expectedDayMinutes: Number(text('expectedHours')) * 60,
    daily: {
      enabled: data.get('dailyEnabled') === 'on',
      startMinutes: dailyStart,
      durationMinutes: Number(text('dailyDuration')),
      label: text('dailyLabel'),
      requestedBy: text('dailyRequestedBy'),
    },
    defaultCategory: text('defaultCategory'),
    defaultRequestedBy: text('defaultRequestedBy'),
    noPlanLabel: text('noPlanLabel'),
    modules: text('modules')
      .split('\n')
      .map((module) => module.trim())
      .filter(Boolean),
    exportFilePrefix: text('exportFilePrefix'),
  };
}

export function SettingsPage() {
  const { settings, saveSettings } = useLogbook();
  const { session, signOut, exitDemo } = useSession();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = readForm(event.currentTarget, settings);
    if (!next) {
      setMessage({ tone: 'error', text: 'Revisa las horas: usa el formato 08:30.' });
      return;
    }
    saveSettings(next).then(
      () => {
        setMessage({ tone: 'success', text: 'Ajustes guardados.' });
      },
      () => {
        setMessage({ tone: 'error', text: 'No se pudieron guardar los ajustes.' });
      },
    );
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Ajustes</h1>
      <form
        key={JSON.stringify(settings)}
        className={styles.form}
        onSubmit={handleSubmit}
        onChange={() => {
          setMessage(null);
        }}
      >
        <fieldset className={styles.group}>
          <legend>Jornada</legend>
          {(Object.keys(CLOCK_FIELDS) as ClockField[]).map((key) => (
            <label key={key}>
              <span>{CLOCK_FIELDS[key]}</span>
              <input
                name={key}
                className="mono"
                required
                defaultValue={formatClock(settings[key])}
              />
            </label>
          ))}
          <label>
            <span>Almuerzo (minutos)</span>
            <input
              name="lunchDuration"
              type="number"
              min="0"
              max="240"
              required
              defaultValue={settings.lunchDurationMinutes}
            />
          </label>
          <label>
            <span>Horas por día</span>
            <input
              name="expectedHours"
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              required
              defaultValue={settings.expectedDayMinutes / 60}
            />
          </label>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Daily automático</legend>
          <label className={styles.check}>
            <input name="dailyEnabled" type="checkbox" defaultChecked={settings.daily.enabled} />
            <span>Agregarlo de lunes a viernes</span>
          </label>
          <label>
            <span>Hora</span>
            <input
              name="dailyStart"
              className="mono"
              required
              defaultValue={formatClock(settings.daily.startMinutes)}
            />
          </label>
          <label>
            <span>Duración (minutos)</span>
            <input
              name="dailyDuration"
              type="number"
              min="5"
              max="240"
              required
              defaultValue={settings.daily.durationMinutes}
            />
          </label>
          <label>
            <span>Categoría y actividad</span>
            <input name="dailyLabel" required defaultValue={settings.daily.label} />
          </label>
          <label>
            <span>Solicitado por</span>
            <input name="dailyRequestedBy" required defaultValue={settings.daily.requestedBy} />
          </label>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Valores por defecto</legend>
          <label>
            <span>Categoría</span>
            <input name="defaultCategory" required defaultValue={settings.defaultCategory} />
          </label>
          <label>
            <span>Solicitado por</span>
            <input name="defaultRequestedBy" required defaultValue={settings.defaultRequestedBy} />
          </label>
          <label>
            <span>Texto para trabajo sin ticket</span>
            <input name="noPlanLabel" required defaultValue={settings.noPlanLabel} />
          </label>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Archivo CSV</legend>
          <label>
            <span>Inicio del nombre del archivo</span>
            <input name="exportFilePrefix" required defaultValue={settings.exportFilePrefix} />
          </label>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Módulos</legend>
          <label className={styles.wide}>
            <span>Uno por línea</span>
            <textarea name="modules" rows={8} defaultValue={settings.modules.join('\n')} />
          </label>
        </fieldset>

        <div className={styles.actions}>
          <button type="submit" className="button button-primary">
            Guardar ajustes
          </button>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
        </div>
      </form>

      <ImportPanel />

      <div className={styles.sessionActions}>
        <button
          type="button"
          className="button"
          onClick={() => {
            if (session.status === 'demo') exitDemo();
            else void signOut();
          }}
        >
          {session.status === 'demo' ? 'Salir de la demo' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  );
}
