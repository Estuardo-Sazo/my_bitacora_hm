import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Splash } from '@/components/Splash';
import { today } from '@/domain/dates';
import { DayPage } from '@/features/day/DayPage';
import { ExportPage } from '@/features/export/ExportPage';
import { AccessDenied } from '@/features/login/AccessDenied';
import { LoginScreen } from '@/features/login/LoginScreen';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { SessionProvider } from '@/session/SessionProvider';
import { useSession } from '@/session/sessionContext';
import { LogbookProvider } from '@/state/LogbookProvider';

function SessionGate() {
  const { session } = useSession();

  switch (session.status) {
    case 'loading':
      return <Splash />;
    case 'signedOut':
      return <LoginScreen />;
    case 'denied':
      return <AccessDenied email={session.email} userId={session.userId} />;
    case 'demo':
    case 'ready':
      return (
        <LogbookProvider
          repository={session.repository}
          draftScope={session.status === 'ready' ? session.user.email : 'demo'}
        >
          <HashRouter>
            <AppShell>
              <Routes>
                <Route path="/dia/:date" element={<DayPage />} />
                <Route path="/exportar" element={<ExportPage />} />
                <Route path="/ajustes" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to={`/dia/${today()}`} replace />} />
              </Routes>
            </AppShell>
          </HashRouter>
        </LogbookProvider>
      );
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <SessionGate />
      </SessionProvider>
    </ErrorBoundary>
  );
}
