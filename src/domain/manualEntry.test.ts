import { describe, expect, it } from 'vitest';
import type { ManualEntryInput } from './manualEntry';
import { buildManualEntry } from './manualEntry';
import { testSettings } from './testFixtures';

const build = (input: Partial<ManualEntryInput>, history: Record<string, string> = {}) =>
  buildManualEntry(
    { kind: 'ticket', ticket: '1204', hours: '1.5', module: 'notas', description: '', ...input },
    {
      settings: testSettings,
      ticketModules: new Map(Object.entries(history)),
      createId: () => 'id',
    },
  );

describe('buildManualEntry', () => {
  it('builds a ticket with the usual defaults and the catalog spelling', () => {
    expect(build({ description: ' revisar promedio ' })).toEqual({
      ok: true,
      entry: {
        id: 'id',
        kind: 'ticket',
        activity: '1204',
        module: 'Notas',
        category: 'Programación',
        requestedBy: 'Ana Ejemplo',
        durationMinutes: 90,
        fixedStartMinutes: null,
        note: 'revisar promedio',
      },
    });
  });

  it('takes the module from history when left blank', () => {
    expect(build({ module: '' }, { '1204': 'Core' })).toMatchObject({
      ok: true,
      entry: { module: 'Core' },
    });
  });

  it('fixes typos and keeps a new module as typed', () => {
    expect(build({ module: 'pplanilla' })).toMatchObject({ entry: { module: 'Planilla' } });
    expect(build({ module: 'Compras' })).toMatchObject({ entry: { module: 'Compras' } });
  });

  it('uses the configured label for work without a ticket', () => {
    expect(build({ kind: 'noPlan', ticket: '' })).toMatchObject({
      entry: { kind: 'noPlan', activity: 'No plan' },
    });
  });

  it('allows meetings without a module and assigns them to the team', () => {
    expect(build({ kind: 'meeting', ticket: '', module: '' })).toMatchObject({
      entry: { activity: 'Reunion', category: 'Reunion', requestedBy: 'ACME', module: '' },
    });
  });

  it('explains every invalid field at once', () => {
    expect(build({ ticket: 'abc', hours: 'mucho', module: '' })).toEqual({
      ok: false,
      errors: {
        ticket: 'Escribe el número de ticket.',
        hours: 'Usa un formato como 1h, 1.5 o 1:30.',
        module: 'Elige el módulo.',
      },
    });
  });
});
