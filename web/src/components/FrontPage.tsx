import { useNow } from '../hooks';
import { dayIndex, dayToIso } from '../lib/days';
import { Sponsored } from './Sponsored';
import { IssueBody, useIssue, useIssueIndex } from './Issue';

export function FrontPage() {
  const now = useNow();
  const today = dayIndex(now);
  const todayIso = dayToIso(today);
  const { index, error: indexError } = useIssueIndex();
  // Today's issue when there is one, otherwise the newest issue on file.
  const chosen = index ? (index.find((e) => e.date === todayIso) ?? index[0] ?? null) : null;
  const { issue, error } = useIssue(chosen?.date ?? null);
  return (
    <>
      <Sponsored day={today} />
      {indexError && <p className="notice notice--error" role="alert">Issue list unavailable: {indexError}</p>}
      {index && !chosen && <p className="notice">No issue has been filed yet.</p>}
      {chosen && chosen.date !== todayIso && (
        <p className="notice">No issue filed for {todayIso} yet. Showing the latest, {chosen.date}.</p>
      )}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {issue && <IssueBody issue={issue} />}
      {!issue && !error && chosen && <p className="legend">Loading issue…</p>}
    </>
  );
}
