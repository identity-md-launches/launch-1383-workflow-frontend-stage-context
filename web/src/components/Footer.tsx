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
        {cfg.network && <li><CopyAddress label={cfg.network.pairToken.symbol} address={cfg.network.pairToken.address} /></li>}
        {cfg.poolKey && <li><CopyAddress label="Pool hook" address={cfg.poolKey.hooks} /></li>}
      </ul>
      <p style={{ marginTop: '1rem' }}>
        Chain {cfg.chainId} ({cfg.network?.name ?? 'unknown'}). <a href={`https://github.com/identity-md-launches/launch-1376-workflow-contract-stage-context/tree/${cfg.manifest.sourceCommit}`} target="_blank" rel="noreferrer">Contract source <code>{cfg.manifest.sourceCommit.slice(0, 7)}</code></a>.{' '}
        <a href="https://github.com/identity-md-launches/launch-1383-workflow-frontend-stage-context" target="_blank" rel="noreferrer">Site source</a>.
        Static site, public RPC, no trackers.
      </p>
    </footer>
  );
}
