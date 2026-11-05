import { Navigate, useParams } from 'react-router-dom';
import { isValidIsoDate, today } from '@/domain/dates';
import { useLogbook } from '@/state/logbookContext';
import { CapturePanel } from './CapturePanel';
import { DayHeader } from './DayHeader';
import styles from './DayPage.module.css';
import { DayTable } from './DayTable';

export function DayPage() {
  const { date = '' } = useParams();
  const { getDay } = useLogbook();

  if (!isValidIsoDate(date)) return <Navigate to={`/dia/${today()}`} replace />;
  const day = getDay(date);

  return (
    <>
      <DayHeader day={day} />
      <div className={styles.columns}>
        <div className={styles.notes}>
          <CapturePanel key={date} day={day} />
        </div>
        <div className={styles.sheet}>
          <DayTable day={day} />
        </div>
      </div>
    </>
  );
}
