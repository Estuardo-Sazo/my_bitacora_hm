import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { Notice } from '@/components/Notice';
import { importCsv } from '@/domain/csv/importCsv';
import type { ImportResult } from '@/domain/csv/importCsv';
import { decodeCsvBytes } from '@/domain/csv/windows1252';
import { countDays } from '@/domain/time';
import { useLogbook } from '@/state/logbookContext';
import styles from './SettingsPage.module.css';

export function ImportPanel() {
  const { days, settings, saveDays, saveSettings } = useLogbook();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle');
  const [importedDays, setImportedDays] = useState(0);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
    setStatus('idle');
    setResult(
      importCsv(text, {
        settings,
        existingDates: new Set(days.map((day) => day.date)),
        createId: () => crypto.randomUUID(),
        importedAt: new Date().toISOString(),
      }),
    );
  };

  const confirmImport = async () => {
    if (!result) return;
    setStatus('saving');
    try {
      await saveSettings({ ...settings, modules: result.modules });
      await saveDays(result.days);
      setImportedDays(result.days.length);
      setResult(null);
      setStatus('done');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <section className={styles.import} aria-labelledby="import-title">
      <h2 id="import-title" className={styles.importTitle}>
        Importar historial
      </h2>
      <p className={styles.importHelp}>
        Sube un CSV de tu bitácora. Esos días quedan como ya exportados, sirven para autocompletar
        módulos y nunca reemplazan días que ya existen aquí.
      </p>
      <input
        className={styles.file}
        type="file"
        accept=".csv,text/csv"
        aria-label="Archivo CSV de historial"
        onChange={(event) => {
          void handleFile(event);
        }}
      />

      {result && (
        <div className={styles.report}>
          <p>
            {result.rowsImported} de {result.rowsRead} filas listas, en{' '}
            {countDays(result.days.length)}.
          </p>
          {result.existingDaysKept > 0 && (
            <p className={styles.detail}>
              {countDays(result.existingDaysKept)} ya en la app, sin cambios.
            </p>
          )}
          {result.duplicatesRemoved > 0 && (
            <p className={styles.detail}>{result.duplicatesRemoved} filas duplicadas se omiten.</p>
          )}
          {result.fieldCorrections > 0 && (
            <p className={styles.detail}>{result.fieldCorrections} filas con valores corregidos.</p>
          )}
          {result.moduleCorrections.length > 0 && (
            <details className={styles.detail}>
              <summary>{result.moduleCorrections.length} módulos unificados</summary>
              <ul>
                {result.moduleCorrections.map((correction) => (
                  <li key={correction}>{correction}</li>
                ))}
              </ul>
            </details>
          )}
          {result.skippedRows.length > 0 && (
            <details className={styles.detail} open>
              <summary>{result.skippedRows.length} filas no se pueden importar</summary>
              <ul>
                {result.skippedRows.map((row) => (
                  <li key={row.line}>
                    Línea {row.line}: {row.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className="button button-primary"
              disabled={result.days.length === 0 || status === 'saving'}
              onClick={() => {
                void confirmImport();
              }}
            >
              {status === 'saving' ? 'Importando…' : `Importar ${countDays(result.days.length)}`}
            </button>
          </div>
        </div>
      )}
      {status === 'done' && (
        <Notice tone="success">Importación lista: {countDays(importedDays)}.</Notice>
      )}
      {status === 'failed' && (
        <Notice tone="error">No se pudo completar la importación. Inténtalo de nuevo.</Notice>
      )}
    </section>
  );
}
