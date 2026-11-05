import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Notice } from '@/components/Notice';
import { Splash } from '@/components/Splash';
import type { LogbookRepository, LogbookSnapshot } from '@/data/repository';
import { createEmptyDay } from '@/domain/defaults';
import { buildTicketModules } from '@/domain/history';
import type { DayLog, IsoDate } from '@/domain/types';
import type { Logbook } from './logbookContext';
import { LogbookContext } from './logbookContext';

const SAVE_ERROR = 'No se pudo guardar el último cambio. Revisa tu conexión e inténtalo de nuevo.';

interface Props {
  repository: LogbookRepository;
  draftScope: string;
  children: ReactNode;
}

export function LogbookProvider({ repository, draftScope, children }: Props) {
  const [snapshot, setSnapshot] = useState<LogbookSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      repository.subscribe(setSnapshot, () => {
        setError('No se pudieron cargar tus datos.');
      }),
    [repository],
  );

  const reportFailure = useCallback((operation: Promise<void>) => {
    operation.catch(() => {
      setError(SAVE_ERROR);
    });
  }, []);

  const logbook = useMemo<Logbook | null>(() => {
    if (!snapshot) return null;
    const daysByDate = new Map<IsoDate, DayLog>(snapshot.days.map((day) => [day.date, day]));
    return {
      ...snapshot,
      draftScope,
      ticketModules: buildTicketModules(snapshot.days),
      getDay: (date) => daysByDate.get(date) ?? createEmptyDay(date, snapshot.settings),
      saveDay: (day) => {
        reportFailure(repository.saveDays([day]));
      },
      saveDays: (days) => repository.saveDays(days),
      saveSettings: (settings) => repository.saveSettings(settings),
      addPending: (items) => {
        reportFailure(repository.addPending(items));
      },
      removePending: (ids) => {
        reportFailure(repository.removePending(ids));
      },
    };
  }, [snapshot, repository, draftScope, reportFailure]);

  if (!logbook) {
    return error ? <Notice tone="error">{error}</Notice> : <Splash />;
  }
  return (
    <LogbookContext.Provider value={logbook}>
      {error && <Notice tone="error">{error}</Notice>}
      {children}
    </LogbookContext.Provider>
  );
}
