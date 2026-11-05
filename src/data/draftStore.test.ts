import { describe, expect, it } from 'vitest';
import { listDraftDates, readDraft, writeDraft } from './draftStore';

describe('draft store', () => {
  it('keeps notes per date', () => {
    writeDraft('demo', '2030-01-07', 'lunes');
    writeDraft('demo', '2030-01-08', 'martes');
    expect(readDraft('demo', '2030-01-07')).toBe('lunes');
    expect(readDraft('demo', '2030-01-09')).toBe('');
    expect(listDraftDates('demo')).toEqual(['2030-01-07', '2030-01-08']);
  });

  it('keeps accounts apart', () => {
    writeDraft('a@example.com', '2030-01-07', 'nota');
    expect(readDraft('demo', '2030-01-07')).toBe('');
    expect(listDraftDates('demo')).toEqual([]);
  });

  it('forgets a draft once it is empty', () => {
    writeDraft('demo', '2030-01-07', 'nota');
    writeDraft('demo', '2030-01-07', '  \n');
    expect(listDraftDates('demo')).toEqual([]);
  });
});
