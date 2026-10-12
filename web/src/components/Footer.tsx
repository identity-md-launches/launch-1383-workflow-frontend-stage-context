import { useState } from 'react';
import { useAppConfig } from '../hooks';

export function CopyAddress({ label, address }: { label: string; address: string }) {
  const cfg = useAppConfig();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  };
  return (
    <span className="addr">
      <span>{label}:</span>
      <code>{address}</code>
      <button className="btn btn--small" onClick={() => void copy()} aria-label={`Copy ${label} address`}>{copied ? 'Copied' : 'Copy'}</button>
      {cfg.explorer && <a href={`${cfg.explorer}/address/${address}`} target="_blank" rel="noreferrer">Explorer</a>}
      <span className="sr-only" aria-live="polite">{copied ? `${label} address copied` : ''}</span>
    </span>
  );
}

export function Footer() {
  const cfg = useAppConfig();
  return (
    <footer>
      <ul>
        {cfg.manifest.contracts.map((c) => (
          <li key={c.name}><CopyAddress label={c.name === 'LaunchToken' ? 'SCOOP token' : c.name} address={c.address} /></li>
        ))}
        {cfg.poolKey && <li><CopyAddress label="Pool hook" address={cfg.poolKey.hooks} /></li>}
      </ul>
      <p style={{ marginTop: '1rem' }}>
        Chain {cfg.chainId} ({cfg.network?.name ?? 'unknown'}). Source commit <code>{cfg.manifest.sourceCommit.slice(0, 12)}</code>, launch <code>{cfg.manifest.launchId}</code>.
        Static site, public RPC, no trackers. Deployment configuration: <a href="./imd-deployment.json">imd-deployment.json</a>.
      </p>
    </footer>
  );
}
