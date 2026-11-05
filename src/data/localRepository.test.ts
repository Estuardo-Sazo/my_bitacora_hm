import { describe, expect, it } from 'vitest';
import { testDay } from '@/domain/testFixtures';
import { createLocalRepository, resetDemoData } from './localRepository';
import type { LogbookSnapshot } from './repository';

function firstSnapshot(repository = createLocalRepository()): Promise<LogbookSnapshot> {
  return new Promise((resolve, reject) => {
    const stop = repository.subscribe((snapshot) => {
      stop();
      resolve(snapshot);
    }, reject);
  });
}

describe('local repository', () => {
  it('starts with sample data', async () => {
    const snapshot = await firstSnapshot();
    expect(snapshot.days.length).toBeGreaterThan(0);
    expect(snapshot.pending).toHaveLength(1);
  });

  it('persists changes across instances', async () => {
    const day = testDay([8], { date: '2030-01-07' });
    await createLocalRepository().saveDays([day]);
    const snapshot = await firstSnapshot();
    expect(snapshot.days.find((item) => item.date === day.date)).toEqual(day);
  });

  it('replaces a day instead of duplicating it', async () => {
    const repository = createLocalRepository();
    await repository.saveDays([testDay([1], { date: '2030-01-07' })]);
    await repository.saveDays([testDay([2], { date: '2030-01-07' })]);
    const { days } = await firstSnapshot(repository);
    expect(days.filter((day) => day.date === '2030-01-07')).toHaveLength(1);
  });

  it('adds and removes pending items', async () => {
    const repository = createLocalRepository();
    const item = { id: 'x', text: 'apoyo', date: '2030-01-07', createdAt: '' };
    await repository.addPending([item]);
    expect((await firstSnapshot(repository)).pending).toContainEqual(item);
    await repository.removePending(['x']);
    expect((await firstSnapshot(repository)).pending).not.toContainEqual(item);
  });

  it('recovers from corrupt storage and can be reset', async () => {
    localStorage.setItem('bitacora.demo.v1', '{nope');
    expect((await firstSnapshot()).days.length).toBeGreaterThan(0);
    await createLocalRepository().saveDays([testDay([1], { date: '2030-01-07' })]);
    resetDemoData();
    const { days } = await firstSnapshot();
    expect(days.some((day) => day.date === '2030-01-07')).toBe(false);
  });
});
