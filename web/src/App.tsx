import { useEffect } from 'react';
import { useAppConfig, useHashRoute } from './hooks';
import { WalletBar } from './components/WalletBar';
import { FrontPage } from './components/FrontPage';
import { Archive, IssuePage } from './components/Archive';
import { Book } from './components/Book';
import { Trade } from './components/Trade';
import { Footer } from './components/Footer';
import { longDate, todayIndex } from './lib/days';

const NAV: { href: string; label: string; match: (r: string) => boolean }[] = [
  { href: '#/', label: 'Front page', match: (r) => r === '/' || r.startsWith('/issue/') },
  { href: '#/archive', label: 'Archive', match: (r) => r === '/archive' },
  { href: '#/book', label: 'Book the front page', match: (r) => r === '/book' },
  { href: '#/trade', label: 'Buy & sell SCOOP', match: (r) => r === '/trade' },
];

export function App() {
  const cfg = useAppConfig();
  const route = useHashRoute();
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
      <a className="skip" href="#main">Skip to content</a>
      <header className="masthead">
        <div className="masthead__ears">
          <span>{longDate(todayIndex())}</span>
          <span>{cfg.network?.name ?? `chain ${cfg.chainId}`} · {cfg.network?.testnet ? 'testnet' : 'mainnet'}</span>
        </div>
        <h1 className="masthead__title"><a href="#/">SCOOP</a></h1>
        <p className="masthead__tag">The scoop on every IMD coin, written by the swarm</p>
      </header>
      <nav className="nav" aria-label="Sections">
        {NAV.map((n) => (
          <a key={n.href} href={n.href} aria-current={n.match(route) ? 'page' : undefined}>{n.label}</a>
        ))}
      </nav>
      <WalletBar />
      <main id="main" tabIndex={-1}>{page}</main>
      <Footer />
    </div>
  );
}
