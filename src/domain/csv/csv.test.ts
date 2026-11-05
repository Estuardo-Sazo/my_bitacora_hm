import { describe, expect, it } from 'vitest';
import { testDay, testEntry, testSettings } from '../testFixtures';
import {
  buildCsvFile,
  buildCsvText,
  buildFileName,
  CSV_COLUMNS,
  dayFingerprint,
  dayStatus,
  markExported,
} from './exportCsv';
import { importCsv, parseCsvRecords } from './importCsv';
import { decodeCsvBytes, encodeWindows1252 } from './windows1252';

const HEADER =
  'Fecha,Inicio,Fin,Duracion,Modulo,Categoria,Subcat PSP,Bug,Bug Categoria,Bug Descripcion,Cliente,Contacto,Actividad,Solicitado por';

describe('buildCsvText', () => {
  it('reproduces the exact line format', () => {
    const day = testDay([], {
      date: '2026-11-02',
      entries: [testEntry({ activity: '1321', durationMinutes: 90 })],
    });
    expect(buildCsvText([day], testSettings)).toBe(
      `${HEADER}\r\n` +
        '02/11/2026,08:30,09:00,00:30,,Daily Scrum,,,,,,,Daily Scrum,ACME\r\n' +
        '02/11/2026,08:00,09:30,01:30,Notas,Programación,,,,,,,1321,Ana Ejemplo\r\n',
    );
  });

  it('keeps 14 columns and sorts days', () => {
    const text = buildCsvText(
      [testDay([1], { date: '2026-11-03' }), testDay([1], { date: '2026-10-29' })],
      testSettings,
    );
    const records = parseCsvRecords(text);
    expect(records.every((record) => record.length === CSV_COLUMNS.length)).toBe(true);
    expect(records[1]?.[0]).toBe('29/10/2026');
  });

  it('quotes fields with commas and never exports private notes', () => {
    const day = testDay([], {
      includeDaily: false,
      entries: [testEntry({ module: 'Core, base', note: 'dato privado' })],
    });
    const text = buildCsvText([day], testSettings);
    expect(text).toContain('"Core, base"');
    expect(text).not.toContain('dato privado');
  });

  it('pads days and months with a zero', () => {
    expect(buildCsvText([testDay([1], { date: '2026-01-05' })], testSettings)).toContain(
      '05/01/2026,08:30',
    );
  });

  it('matches the browser decoder for every character it can write', () => {
    const text = 'Programación ñandú Ü € “citas” — ©';
    expect(new TextDecoder('windows-1252').decode(encodeWindows1252(text).bytes)).toBe(text);
  });

  it('reports characters it cannot represent', () => {
    const { bytes, unmappable } = encodeWindows1252('a😀');
    expect(unmappable).toEqual(['😀']);
    expect([...bytes]).toEqual([0x61, 0x3f]);
  });

  it('builds the final file bytes', () => {
    const day = testDay([1], { includeDaily: false });
    const { bytes } = buildCsvFile([day], testSettings);
    expect(bytes).toContain(0xf3);
    expect(bytes.at(-2)).toBe(0x0d);
    expect(bytes.at(-1)).toBe(0x0a);
  });

  it('detects UTF-8 and falls back to Windows-1252 when reading', () => {
    expect(decodeCsvBytes(new TextEncoder().encode('Programación'))).toBe('Programación');
    expect(decodeCsvBytes(encodeWindows1252('Programación').bytes)).toBe('Programación');
  });
});

describe('export tracking', () => {
  it('names files like the current ones', () => {
    expect(buildFileName('Bitacora', '2026-01-16')).toBe('Bitacora_16012026.csv');
  });

  it('moves a day through its states', () => {
    const day = testDay([8]);
    expect(dayStatus(undefined, testSettings)).toBe('empty');
    expect(dayStatus(testDay([]), testSettings)).toBe('empty');
    expect(dayStatus(testDay([8], { dayType: 'off' }), testSettings)).toBe('off');
    expect(dayStatus(day, testSettings)).toBe('draft');

    const exported = markExported(day, testSettings, '2026-11-03T20:00:00Z');
    expect(dayStatus(exported, testSettings)).toBe('exported');

    const edited = {
      ...exported,
      entries: exported.entries.map((entry) => ({ ...entry, durationMinutes: 420 })),
    };
    expect(dayStatus(edited, testSettings)).toBe('modified');
  });

  it('does not flag the history when global formats change', () => {
    const exported = markExported(testDay([8]), testSettings, '2026-11-03T20:00:00Z');
    const changed = {
      ...testSettings,
      daily: { ...testSettings.daily, requestedBy: 'Otro equipo' },
    };
    expect(dayStatus(exported, changed)).toBe('exported');
  });

  it('notices when the Daily is turned off after exporting', () => {
    const exported = markExported(testDay([8]), testSettings, '2026-11-03T20:00:00Z');
    expect(dayStatus({ ...exported, includeDaily: false }, testSettings)).toBe('modified');
  });

  it('does not treat private notes as changes to the export', () => {
    const day = testDay([8]);
    const withNote = {
      ...day,
      entries: day.entries.map((entry) => ({ ...entry, note: 'nota' })),
    };
    expect(dayFingerprint(withNote, testSettings)).toBe(dayFingerprint(day, testSettings));
  });
});

describe('parseCsvRecords', () => {
  it('handles quotes, escaped quotes and CRLF', () => {
    expect(parseCsvRecords('a,"b,c","d""e"\r\n1,2,3')).toEqual([
      ['a', 'b,c', 'd"e'],
      ['1', '2', '3'],
    ]);
  });

  it('detects the semicolon delimiter', () => {
    expect(parseCsvRecords('a;b;c\n1;2;3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });
});

describe('importCsv', () => {
  let id = 0;
  const run = (text: string, existing: string[] = []) =>
    importCsv(text, {
      settings: testSettings,
      existingDates: new Set(existing),
      createId: () => `id-${(id += 1)}`,
      importedAt: '2026-11-04T00:00:00Z',
    });

  const csv = (...rows: string[]) => [HEADER, ...rows].join('\r\n') + '\r\n';
  const daily = (date: string) => `${date},08:30,09:00,00:30,,Daily Scrum,,,,,,,Daily Scrum,ACME`;
  const work = (date: string, start: string, end: string, module: string, activity: string) =>
    `${date},${start},${end},,${module},Programación,,,,,,,${activity},Ana Ejemplo`;

  it('round-trips an export without changes', () => {
    const original = testDay([1, 2, 1, 2, 2], { date: '2026-11-03' });
    const result = run(buildCsvText([original], testSettings));
    expect(buildCsvText(result.days, testSettings)).toBe(buildCsvText([original], testSettings));
    expect(dayStatus(result.days[0], testSettings)).toBe('exported');
  });

  it('reads columns by name, as in the Excel order with an extra comment column', () => {
    const text =
      'Fecha,Inicio,Fin,Duracion,Modulo,Categoria,Bug,Subcat PSP,Bug Categoria,Bug Descripcion,Cliente,Contacto,Actividad,Solicitado por,Columna1\r\n' +
      '03/11/2026,08:00:00,09:00:00,01:00:00,Notas,Programación,,,,,,,1001,Ana Ejemplo,comentario\r\n';
    const { days } = run(text);
    expect(days[0]?.entries[0]).toMatchObject({
      activity: '1001',
      durationMinutes: 60,
      fixedStartMinutes: 480,
      note: 'comentario',
    });
  });

  it('unifies module spellings toward the most common form', () => {
    const { days, modules, moduleCorrections } = run(
      csv(
        work('2/11/2026', '08:00', '09:00', 'Suministros', '1'),
        work('2/11/2026', '09:00', '10:00', 'Suministros', '2'),
        work('2/11/2026', '10:00', '11:00', 'suministros', '3'),
        work('2/11/2026', '11:00', '12:00', 'Sumnistros', '4'),
      ),
    );
    expect(days[0]?.entries.map((entry) => entry.module)).toEqual(Array(4).fill('Suministros'));
    expect(modules.filter((module) => module === 'Suministros')).toHaveLength(1);
    expect(moduleCorrections).toEqual(['suministros → Suministros', 'Sumnistros → Suministros']);
  });

  it('keeps similar but different modules apart', () => {
    const { days } = run(
      csv(
        work('2/11/2026', '08:00', '09:00', 'Notas', '1'),
        work('2/11/2026', '09:00', '10:00', 'Zonas', '2'),
      ),
    );
    expect(days[0]?.entries.map((entry) => entry.module)).toEqual(['Notas', 'Zonas']);
  });

  it('unifies No Plan spellings and drops one typed as a module', () => {
    const { days, fieldCorrections } = run(
      csv(work('2/11/2026', '08:00', '09:00', 'No planig', 'No planig')),
    );
    expect(days[0]?.entries[0]).toMatchObject({ activity: 'No plan', module: '', kind: 'noPlan' });
    expect(fieldCorrections).toBe(1);
  });

  it('trusts Inicio and Fin over a wrong Duracion', () => {
    const { days } = run(
      csv('25/8/2026,11:00,11:30,192:00,Notas,Programación,,,,,,,1,Ana Ejemplo'),
    );
    expect(days[0]?.entries[0]?.durationMinutes).toBe(30);
  });

  it('repairs a category or requester that is not text, and non-breaking spaces', () => {
    const { days, fieldCorrections } = run(
      csv('22/1/2026,09:30,12:00,02:30,Core,46049,,,,,,,1001 ,{'),
    );
    expect(days[0]?.entries[0]).toMatchObject({
      activity: '1001',
      kind: 'ticket',
      category: 'Programación',
      requestedBy: 'Ana Ejemplo',
    });
    expect(fieldCorrections).toBe(1);
  });

  it('removes a day imported twice in the same file', () => {
    const row = work('9/9/2026', '08:00', '12:00', 'Notas', '1');
    const { days, duplicatesRemoved } = run(csv(row, row));
    expect(days[0]?.entries).toHaveLength(1);
    expect(duplicatesRemoved).toBe(1);
  });

  it('reports invalid rows instead of inventing data', () => {
    const { skippedRows, rowsRead, rowsImported } = run(
      csv(
        work('fecha mala', '08:00', '09:00', 'Notas', '1'),
        work('2/11/2026', '09:00', '09:00', 'Notas', '2'),
      ),
    );
    expect(rowsRead).toBe(2);
    expect(rowsImported).toBe(0);
    expect(skippedRows.map((row) => row.line)).toEqual([2, 3]);
  });

  it('never overwrites days that already exist', () => {
    const { days, existingDaysKept } = run(csv(daily('2/11/2026'), daily('3/11/2026')), [
      '2026-11-02',
    ]);
    expect(days.map((day) => day.date)).toEqual(['2026-11-03']);
    expect(existingDaysKept).toBe(1);
  });

  it('recognizes meetings', () => {
    const { days } = run(csv('5/8/2026,10:00,11:00,01:00,,Reunion,,,,,,,Reunion,ACME'));
    expect(days[0]?.entries[0]).toMatchObject({ kind: 'meeting', activity: 'Reunion' });
  });
});
