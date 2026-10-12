import { useEffect } from 'react';
import { useHashRoute, useNow } from './hooks';
import { useIssueIndex } from './components/Issue';
import { latestIssue } from './lib/issues';
import { FrontPage } from './components/FrontPage';
import { Archive, IssuePage } from './components/Archive';
import { Book } from './components/Book';
import { Trade } from './components/Trade';
import { Footer } from './components/Footer';
import { longDate, dayIndex, dayToIso, isoToDay } from './lib/days';

const NAV: { href: string; label: string; match: (r: string) => boolean }[] = [
  { href: '#/', label: 'Front', match: (r) => r === '/' || r.startsWith('/issue/') },
  { href: '#/archive', label: 'Archive', match: (r) => r === '/archive' },
  { href: '#/book', label: 'Advertise', match: (r) => r === '/book' },
  { href: '#/trade', label: 'Trade', match: (r) => r === '/trade' },
];

export function App() {
  const route = useHashRoute();
  const today = dayIndex(useNow());
  const { index } = useIssueIndex();
  const edition = route.startsWith('/issue/') ? index?.find(i => i.date === route.slice(7)) : index && latestIssue(index, dayToIso(today));
  useEffect(() => {
    const main = document.getElementById('main');
    if (main && route !== '/') main.focus({ preventScroll: false });
    window.scrollTo({ top: 0 });
  }, [route]);

  let page;
  if (route === '/archive') page = <Archive />;
  else if (route.startsWith('/issue/')) page = <IssuePage date={route.slice('/issue/'.length)} />;
  else if (route === '/book') page = <Book />;
  else if (route === '/trade') page = <Trade />;
  else page = <FrontPage />;

  return (
    <div className="page">
      <a className="skip" href="#main" onClick={(e) => {
        e.preventDefault();
        const main = document.getElementById('main');
        main?.focus({ preventScroll: true });
        main?.scrollIntoView({ block: 'start' });
      }}>Skip to content</a>
      <header className="masthead">
        <h1 className="masthead__title"><a href="#/">SCOOP</a></h1>
        <p className="masthead__tag">The scoop on every IMD coin, written by the swarm</p>
        <p className="masthead__folio">Vol. I · No. {edition?.number ?? '—'} · {longDate(edition ? isoToDay(edition.date) : today)} · Ethereum edition</p>
      </header>
      <nav className="nav" aria-label="Sections">
        {NAV.map((n, i) => (
          <a key={n.href} href={n.href} aria-current={n.match(route) ? 'page' : undefined}>{i > 0 && <span className="nav__dot" aria-hidden="true">·</span>}{n.label}</a>
        ))}
      </nav>
      <main id="main" tabIndex={-1}>{page}</main>
      <Footer />
    </div>
  );
}
