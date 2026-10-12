import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { validateIndex, validateIssue, validDate, type Issue, type IssueSection } from '../lib/issues';
export type { Issue, IssueItem, IssueSection, IssueIndexEntry } from '../lib/issues';

export function useIssueIndex() {
  const query = useQuery({ queryKey: ['issue-index'], queryFn: async ({ signal }) => {
    const r = await fetch('./issues/index.json', { signal, cache: 'no-cache' });
    if (!r.ok) throw new Error('Issue index unavailable');
    return validateIndex(await r.json());
  }, refetchInterval: 60_000 });
  return { index: query.data, error: query.error, retry: query.refetch };
}
export function useIssue(date: string | null) {
  const query = useQuery({ queryKey: ['issue', date], enabled: date !== null, queryFn: async ({ signal }) => {
    if (!validDate(date)) throw new Error('Invalid date');
    const r = await fetch(`./issues/${date}.json`, { signal });
    if (!r.ok) throw new Error('Issue unavailable');
    return validateIssue(await r.json(), date);
  } });
  return { issue: query.data, error: query.error, retry: query.refetch };
}

function Items({ section }: { section: IssueSection }) {
  return <section className="issue-section" aria-label={section.title}>
    <h3>{section.title}</h3>
    {section.items.length === 0 && <p className="legend">Nothing to report.</p>}
    {section.items.map((it, i) => <div className="item" key={i}>
      <span className="item__token">{it.token}</span><span className="item__figure">{it.figure}</span><p className="item__line">{it.line}</p>
    </div>)}
  </section>;
}
function InkGraphic({ section }: { section?: IssueSection }) {
  const values = section?.items.flatMap(i => {
    const match = i.figure.match(/^([\d,]+(?:\.\d+)?) IMD$/);
    return match ? [{ ...i, value: Number(match[1].replaceAll(',', '')) }] : [];
  }) ?? [];
  if (!values.length) return null;
  const max = Math.max(...values.map(i => i.value));
  return <figure className="ink-graphic" aria-labelledby="graphic-title">
    <figcaption><h3 id="graphic-title">Where the IMD changed hands</h3><p>Biggest movers by pool turnover · IMD in the reporting window</p></figcaption>
    <ol className="bar-chart">{values.map((i, n) => <li key={i.token}>
      <div className="bar-chart__label"><span>{i.token}</span><span className="num">{i.figure}</span></div>
      <div className="bar-chart__track" aria-hidden="true"><span className={n === 0 ? 'bar-chart__bar bar-chart__bar--red' : 'bar-chart__bar'} style={{ width: `${max ? i.value / max * 100 : 0}%` }} /></div>
    </li>)}</ol>
    <p className="legend">Gross IMD turnover, not price returns. The absolute IMD leg is counted once per swap.</p>
  </figure>;
}
export function IssueBody({ issue, advertisement }: { issue: Issue; advertisement?: ReactNode }) {
  const numbers = issue.sections.find(s => s.title === 'Swarm numbers');
  const story = issue.sections.find(s => s.title === 'Story of the day');
  const body = issue.body ?? story?.items.map(i => i.line) ?? [];
  const news = issue.sections.filter(s => s !== numbers && s !== story);
  return <article className="newspaper" aria-labelledby="issue-headline">
    <div className="issue-lead">
      <p className="story-label">Story of the day</p>
      <h2 id="issue-headline" className="issue__headline">{issue.headline}</h2>
      {(issue.deck || issue.standfirst) && <p className="issue__deck">{issue.deck ?? issue.standfirst}</p>}
      <div className="issue__body">{body.map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
      <p className="issue__byline">By the swarm</p>
    </div>
    {numbers && <aside className="swarm-rail" aria-labelledby="swarm-h"><div className="swarm-box">
      <h3 id="swarm-h">Swarm numbers</h3>
      {numbers.items.map((i, n) => <div className="swarm-stat" key={n}><p className="swarm-stat__figure">{i.figure}</p><p className="swarm-stat__label">{i.token}</p><p className="swarm-stat__note">{i.line}</p></div>)}
    </div></aside>}
    <InkGraphic section={news.find(s => s.title === 'Biggest movers')} />
    {advertisement && <div className="issue-ad">{advertisement}</div>}
    <div className="news-columns">{news.map((s, i) => <Items section={s} key={i} />)}</div>
    {(issue.reporting || issue.standfirst) && <aside className="reporting" aria-label="Reporting sources">
      <h3>How this issue was reported</h3>
      {issue.standfirst && <p>{issue.standfirst}</p>}
      {issue.reporting?.note && <p>{issue.reporting.note}</p>}
      <ul>{issue.reporting?.sources?.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
    </aside>}
  </article>;
}
