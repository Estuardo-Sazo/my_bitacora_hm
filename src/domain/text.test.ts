import { describe, expect, it } from 'vitest';
import { closestMatch, editDistance, normalizeText } from './text';

const catalog = ['Notas', 'Zonas', 'Planilla', 'Asignaciones'];

describe('normalizeText', () => {
  it('ignores case, accents and non-breaking spaces', () => {
    expect(normalizeText('  Programación Web ')).toBe('programacion web');
  });
});

describe('editDistance', () => {
  it('counts a swap of neighbours as one edit', () => {
    expect(editDistance('notsa', 'notas')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('', 'abc')).toBe(3);
  });
});

describe('closestMatch', () => {
  it('fixes the typos found in real notes', () => {
    expect(closestMatch('pplanilla', catalog)).toBe('Planilla');
    expect(closestMatch('Asiganciones', catalog)).toBe('Asignaciones');
  });

  it('does not confuse Notas with Zonas', () => {
    expect(closestMatch('Zonas', ['Notas'])).toBeNull();
  });

  it('refuses to guess between two equally close modules', () => {
    expect(closestMatch('Nonas', catalog)).toBeNull();
  });

  it('leaves unrelated words and very short words alone', () => {
    expect(closestMatch('apoyo', catalog)).toBeNull();
    expect(closestMatch('en', ['El'])).toBeNull();
  });
});
