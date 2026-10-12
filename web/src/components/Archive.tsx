import { isoToDay, longDate } from '../lib/days';
import { IssueBody, useIssue, useIssueIndex } from './Issue';

export function Archive() {
  const { index, error } = useIssueIndex();
  return (
    <section className="section" aria-labelledby="archive-h">
      <p className="section__kicker">Archive</p>
      <h2 id="archive-h">Every issue</h2>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {index && index.length === 0 && <p>No issues yet.</p>}
      {index && (
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">No.</th><th scope="col">Date</th><th scope="col">Headline</th></tr></thead>
            <tbody>
              {index.map((e) => (
                <tr key={e.date}>
                  <td className="num">{e.number}</td>
                  <td>{longDate(isoToDay(e.date))}</td>
                  <td><a href={`#/issue/${e.date}`}>{e.headline}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="legend" style={{ marginTop: '1rem' }}>Issues are JSON files under <code>issues/</code> in the site export, one per UTC day.</p>
    </section>
  );
}

export function IssuePage({ date }: { date: string }) {
  const { issue, error } = useIssue(date);
  return (
    <>
      <p style={{ marginTop: '1rem' }}><a href="#/archive">← Archive</a></p>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {issue && <IssueBody issue={issue} />}
    </>
  );
}
