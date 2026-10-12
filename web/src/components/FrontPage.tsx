import { useNow } from '../hooks';
import { dayIndex, dayToIso } from '../lib/days';
import { AT_PRESS, latestIssue } from '../lib/issues';
import { Sponsored } from './Sponsored';
import { IssueBody, useIssue, useIssueIndex } from './Issue';
import { RetryNotice } from './Feedback';

export function FrontPage() {
  const today = dayIndex(useNow());
  const todayIso = dayToIso(today);
  const { index, error: indexError, retry: retryIndex } = useIssueIndex();
  const chosen = index ? latestIssue(index, todayIso) : null;
  const { issue, error, retry } = useIssue(chosen?.date ?? null);
  return <>
    {indexError && <RetryNotice message="The issue list could not load. Try again." retry={retryIndex} />}
    {index && !chosen && <p className="notice">Today's issue is at the press. Please check back soon.</p>}
    {chosen && chosen.date !== todayIso && <p className="press-note" role="status">{AT_PRESS}</p>}
    {error && <RetryNotice message="This issue could not load. Try again." retry={retry} />}
    {issue && <IssueBody issue={issue} advertisement={<Sponsored day={today} />} />}
    {!issue && !error && !indexError && <p className="legend">{chosen || !index ? 'Opening the paper…' : ''}</p>}
  </>;
}
