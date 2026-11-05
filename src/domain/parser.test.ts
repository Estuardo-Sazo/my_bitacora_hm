import { describe, expect, it } from 'vitest';
import type { ParsedLine } from './parser';
import { parseNotes } from './parser';
import { testSettings } from './testFixtures';

function parse(text: string, history: Record<string, string> = {}): ParsedLine[] {
  let id = 0;
  return parseNotes(text, {
    settings: testSettings,
    ticketModules: new Map(Object.entries(history)),
    createId: () => `id-${(id += 1)}`,
  });
}

function parseEntry(text: string, history: Record<string, string> = {}) {
  const [line] = parse(text, history);
  if (line?.type !== 'entry') throw new Error(`Se esperaba una entrada: ${text}`);
  return line;
}

describe('tickets', () => {
  it('reads ticket, hours and module', () => {
    expect(parseEntry('1207 2h planilla').entry).toMatchObject({
      kind: 'ticket',
      activity: '1207',
      durationMinutes: 120,
      module: 'Planilla',
      category: 'Programación',
      requestedBy: 'Ana Ejemplo',
    });
  });

  it('reads hours without a unit and fixes the module typo', () => {
    const { entry, hints } = parseEntry('1208 3 pplanilla');
    expect(entry).toMatchObject({ durationMinutes: 180, module: 'Planilla' });
    expect(hints).toContainEqual({ type: 'moduleCorrected', from: 'pplanilla', to: 'Planilla' });
  });

  it('accepts a detached unit', () => {
    expect(parseEntry('1190 3 h notas').entry).toMatchObject({
      durationMinutes: 180,
      module: 'Notas',
      note: '',
    });
  });

  it('takes the module from history when omitted', () => {
    const { entry, hints } = parseEntry('1204 1h', { '1204': 'Notas' });
    expect(entry.module).toBe('Notas');
    expect(hints).toContainEqual({ type: 'moduleFromHistory', module: 'Notas' });
  });

  it('prefers the typed module over history', () => {
    expect(parseEntry('1204 1h core', { '1204': 'Notas' }).entry.module).toBe('Core');
  });

  it('keeps free text after the module as a private note', () => {
    expect(parseEntry('1204 1h notas revisar promedio').entry.note).toBe('revisar promedio');
  });

  it('matches modules with several words', () => {
    expect(parseEntry('1204 1h pagina web banner')).toMatchObject({
      entry: { module: 'Pagina Web', note: 'banner' },
    });
  });

  it('flags what is missing without losing the line', () => {
    expect(parseEntry('99999').hints).toEqual([
      { type: 'missingDuration' },
      { type: 'missingModule' },
    ]);
  });
});

describe('unplanned work', () => {
  it.each(['no plan', 'No Plan', 'No planig', 'No plannig', 'noplan'])(
    'unifies the spelling %s',
    (label) => {
      expect(parseEntry(`${label} 2h core`).entry).toMatchObject({
        kind: 'noPlan',
        activity: 'No plan',
        module: 'Core',
      });
    },
  );

  it('keeps the description as a note and asks for the module', () => {
    const { entry, hints } = parseEntry('No plan 2h apoyo en cliente y pase a producción');
    expect(entry.note).toBe('apoyo en cliente y pase a producción');
    expect(entry.module).toBe('');
    expect(hints).toContainEqual({ type: 'missingModule' });
  });

  it('treats support with hours as unplanned work', () => {
    expect(parseEntry('apoyo 1h core ajuste de datos').entry).toMatchObject({
      kind: 'noPlan',
      module: 'Core',
      note: 'ajuste de datos',
    });
  });

  it('treats a line that starts with hours as unplanned work', () => {
    expect(parseEntry('1h core revisar servidor').entry.kind).toBe('noPlan');
  });
});

describe('meetings', () => {
  it('uses the meeting as category and the team as requester, module optional', () => {
    const { entry, hints } = parseEntry('reunión 1h');
    expect(entry).toMatchObject({
      kind: 'meeting',
      activity: 'Reunion',
      category: 'Reunion',
      requestedBy: 'ACME',
    });
    expect(hints).toEqual([]);
  });

  it('recognizes client meetings', () => {
    expect(parseEntry('reunion cliente 1h').entry.category).toBe('Reunion Cliente');
  });
});

describe('free text', () => {
  it('turns support without hours into pending items', () => {
    expect(parse('Apoyo pasar la nota a 0 en física')).toEqual([
      expect.objectContaining({ type: 'pending', text: 'pasar la nota a 0 en física' }),
    ]);
  });

  it('keeps unknown lines as pending instead of failing', () => {
    expect(parse('Cliente, conteo de ausencias en el 4to periodo')[0]).toMatchObject({
      type: 'pending',
      text: 'Cliente, conteo de ausencias en el 4to periodo',
    });
  });

  it('ignores headers and blank lines', () => {
    const lines = parse('Ticket trabajados Nov 2\n\nTrabajos Nov 3\n\nApoyo\n');
    expect(lines.map((line) => line.type)).toEqual(['ignored', 'ignored', 'ignored']);
  });

  it('reads a whole pasted note', () => {
    const lines = parse(
      'Trabajos Nov 3\r\n\r\n1204 1h\r\n1207 2h planilla\r\n\r\nNo plan 2h core\r\n\r\nApoyo revisar correo',
      { '1204': 'Notas' },
    );
    expect(lines.map((line) => line.type)).toEqual([
      'ignored',
      'entry',
      'entry',
      'entry',
      'pending',
    ]);
  });
});
