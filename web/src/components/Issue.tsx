import { useEffect, useState } from 'react';
import { isoToDay, longDate } from '../lib/days';

export interface IssueItem { token: string; figure: string; line: string }
export interface IssueSection { title: string; items: IssueItem[] }
export interface Issue {
  date: string; number: number; headline: string; standfirst?: string; sections: IssueSection[];
  reporting?: { sources?: { title: string; url: string }[]; note?: string };
}
export interface IssueIndexEntry { date: string; number: number; headline: string }

export function useIssueIndex() {
  const [index, setIndex] = useState<IssueIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch('./issues/index.json').then(async (r) => {
      if (!r.ok) throw new Error(`issues/index.json: ${r.status}`);
      const list = (await r.json()) as IssueIndexEntry[];
      setIndex([...list].sort((a, b) => (a.date < b.date ? 1 : -1)));
    }).catch((e) => setError(String(e.message ?? e)));
  }, []);
  return { index, error };
}

export function useIssue(date: string | null) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setIssue(null); return; }
    setIssue(null); setError(null);
    fetch(`./issues/${date}.json`).then(async (r) => {
      if (!r.ok) throw new Error(`No issue for ${date}`);
      setIssue((await r.json()) as Issue);
    }).catch((e) => setError(String(e.message ?? e)));
  }, [date]);
  return { issue, error };
}

export function IssueBody({ issue }: { issue: Issue }) {
  return (
    <article aria-labelledby="issue-headline">
      <div className="issue__dateline">
        <span>Issue No. <span className="num">{issue.number}</span></span>
        <span>{longDate(isoToDay(issue.date))}</span>
      </div>
      <h2 id="issue-headline" className="issue__headline">{issue.headline}</h2>
      {issue.standfirst && <p className="issue__standfirst">{issue.standfirst}</p>}
      <div className="columns columns--3" style={{ marginTop: '1.5rem' }}>
        {issue.sections.map((s) => (
          <section key={s.title} className="issue-section" aria-label={s.title}>
            <h3>{s.title}</h3>
            {s.items.length === 0 && <p className="legend">Nothing to report.</p>}
            {s.items.map((it, i) => (
              <div className="item" key={i}>
                <span className="item__token">{it.token}</span>
                <span className="item__figure">{it.figure}</span>
                <p className="item__line">{it.line}</p>
              </div>
            ))}
          </section>
        ))}
      </div>
      {issue.reporting && <aside className="section reporting" aria-label="Reporting sources">
        {issue.reporting.note && <p>{issue.reporting.note}</p>}
        <ul>{issue.reporting.sources?.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>
      </aside>}
    </article>
  );
}
