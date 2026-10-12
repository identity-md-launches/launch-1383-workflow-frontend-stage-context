import { useEffect, useState } from 'react';
import { useConnect, useDisconnect } from 'wagmi';
import { useAppConfig, useWallet } from '../hooks';
import { errorText, NO_WALLET, shortAddress } from '../lib/format';

export function WalletBar() {
  const cfg = useAppConfig();
  const w = useWallet();
  const { connectors, connect, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const name = cfg.network?.name ?? `chain ${cfg.chainId}`;
  const [available, setAvailable] = useState<typeof connectors>([]);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const results = await Promise.all(connectors.map(async (connector) => {
        try { return { connector, provider: await connector.getProvider() }; } catch { return null; }
      }));
      if (!cancelled) {
        const providers = new Set<unknown>();
        const found: typeof connectors[number][] = [];
        // Prefer a discovered wallet's identity over the generic connector for the same provider.
        for (const result of results.sort((a, b) => Number(a?.connector.name === 'Injected') - Number(b?.connector.name === 'Injected'))) {
          if (!result?.provider || providers.has(result.provider)) continue;
          providers.add(result.provider);
          found.push(result.connector);
        }
        setAvailable(found);
        setChecked(true);
      }
    };
    void check();
    window.addEventListener('ethereum#initialized', check);
    return () => { cancelled = true; window.removeEventListener('ethereum#initialized', check); };
  }, [connectors]);

  return (
    <div className="walletbar" aria-label="Wallet">
      <div className="walletbar__status" aria-live="polite">
        {!w.isConnected && checked && available.length > 0 && <span>Connect to book or trade.</span>}
        {w.isConnected && w.address && (
          <>
            <span>Connected: <a className="mono" href={`${cfg.explorer}/address/${w.address}`} target="_blank" rel="noreferrer" title={w.address}>{shortAddress(w.address)}</a></span>
            {w.onChain ? <span className="badge">{name}</span> : <span className="badge badge--red">Wrong network</span>}
            {w.onChain && !w.canTransact && <span>Preparing wallet…</span>}
          </>
        )}
      </div>
      <div className="row">
        {!w.isConnected && checked && available.length === 0 && <div className="missing-wallet"><p role="status">{NO_WALLET}</p><div className="wallet-links" aria-label="Open in a wallet">
          <a className="btn" href="https://metamask.app.link/dapp/scoop.sites.imd.fun">MetaMask</a>
          <a className="btn" href="https://go.cb-w.com/dapp?cb_url=https%3A%2F%2Fscoop.sites.imd.fun">Coinbase Wallet</a>
          <a className="btn" href="https://link.trustwallet.com/open_url?coin_id=60&url=https%3A%2F%2Fscoop.sites.imd.fun">Trust Wallet</a>
        </div></div>}
        {!w.isConnected && !checked && <span>Checking for a wallet…</span>}
        {!w.isConnected && available.map((c) => (
          <div key={c.uid} className="row">
          {c.name !== 'Injected' && <span>{c.name}</span>}
          <button className="btn btn--primary" disabled={isPending} title={c.name === 'Injected' ? undefined : c.name} onClick={() => connect({ connector: c })}>
            {isPending ? 'Connecting…' : 'Connect wallet'}
          </button>
          </div>
        ))}
        {w.isConnected && !w.onChain && (
          <button className="btn btn--accent" disabled={w.switching} onClick={() => void w.switchToLaunchChain()}>
            {w.switching ? 'Switching…' : `Switch to ${name}`}
          </button>
        )}
        {w.isConnected && <button className="btn" onClick={() => disconnect()}>Disconnect</button>}
      </div>
      {connectError && <p className="notice notice--error" role="alert" style={{ width: '100%' }}>{errorText(connectError)}</p>}
      {w.switchError && <p className="notice notice--error" role="alert" style={{ width: '100%' }}>{w.switchError}</p>}
    </div>
  );
}
