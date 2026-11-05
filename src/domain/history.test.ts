import { describe, expect, it } from 'vitest';
import { createEmptyDay, withSettingsDefaults } from './defaults';
import { buildTicketModules } from './history';
import { matchModule } from './modules';
import { testDay, testEntry, testSettings } from './testFixtures';

describe('buildTicketModules', () => {
  it('keeps the most recent module regardless of input order', () => {
    const newer = testDay([], {
      date: '2026-11-02',
      entries: [testEntry({ activity: '5', module: 'Core' })],
    });
    const older = testDay([], {
      date: '2026-10-01',
      entries: [testEntry({ activity: '5', module: 'Notas' })],
    });
    expect(buildTicketModules([newer, older]).get('5')).toBe('Core');
  });

  it('ignores unplanned work and empty modules', () => {
    const day = testDay([], {
      entries: [
        testEntry({ kind: 'noPlan', activity: 'No plan', module: 'Core' }),
        testEntry({ activity: '7', module: '' }),
      ],
    });
    expect(buildTicketModules([day]).size).toBe(0);
  });
});

describe('defaults', () => {
  it('skips the Daily on weekends', () => {
    expect(createEmptyDay('2026-11-03', testSettings).includeDaily).toBe(true);
    expect(createEmptyDay('2026-11-07', testSettings).includeDaily).toBe(false);
  });

  it('fills fields missing from stored settings', () => {
    const settings = withSettingsDefaults({ noPlanLabel: 'Sin plan' });
    expect(settings.noPlanLabel).toBe('Sin plan');
    expect(settings.daily.durationMinutes).toBe(30);
    expect(withSettingsDefaults(null).workdayStartMinutes).toBe(480);
  });
});

describe('matchModule', () => {
  it('returns nothing without words', () => {
    expect(matchModule([], testSettings.modules)).toBeNull();
  });
});
