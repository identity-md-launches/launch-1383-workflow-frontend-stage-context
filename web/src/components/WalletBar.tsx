import { useEffect, useState } from 'react';
import { useConnect, useDisconnect } from 'wagmi';
import { useAppConfig, useWallet } from '../hooks';
import { shortAddress } from '../lib/format';

const NO_WALLET = 'No wallet found. Open this site in a wallet browser or install a browser wallet.';

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
        try { return await connector.getProvider() ? connector : null; } catch { return null; }
      }));
      if (!cancelled) {
        setAvailable(results.filter((c): c is (typeof connectors)[number] => c !== null));
        setChecked(true);
      }
    };
    void check();
    window.addEventListener('ethereum#initialized', check);
    return () => { cancelled = true; window.removeEventListener('ethereum#initialized', check); };
  }, [connectors]);
  const missingProvider = /provider.*not found|provider.*not available/i.test(connectError?.message ?? '');

  return (
    <div className="walletbar" aria-label="Wallet">
      <div className="walletbar__status" aria-live="polite">
        {!w.isConnected && <span>No wallet connected. Reads use public RPC.</span>}
        {w.isConnected && w.address && (
          <>
            <span>Connected: <a className="mono" href={`${cfg.explorer}/address/${w.address}`} target="_blank" rel="noreferrer" title={w.address}>{shortAddress(w.address)}</a></span>
            {w.onChain ? <span className="badge">{name}</span> : <span className="badge badge--red">Wrong network</span>}
          </>
        )}
      </div>
      <div className="row">
        {!w.isConnected && checked && available.length === 0 && <span>{NO_WALLET}</span>}
        {!w.isConnected && !checked && <span>Checking for a wallet…</span>}
        {!w.isConnected && available.map((c) => (
          <button key={c.uid} className="btn btn--primary" disabled={isPending} onClick={() => connect({ connector: c })}>
            {isPending ? 'Connecting…' : c.name === 'Injected' ? 'Connect wallet' : `Connect ${c.name}`}
          </button>
        ))}
        {w.isConnected && !w.onChain && (
          <button className="btn btn--accent" disabled={w.switching} onClick={() => void w.switchToLaunchChain()}>
            {w.switching ? 'Switching…' : `Switch to ${name}`}
          </button>
        )}
        {w.isConnected && <button className="btn" onClick={() => disconnect()}>Disconnect</button>}
      </div>
      {connectError && <p className="notice notice--error" role="alert" style={{ width: '100%' }}>{missingProvider ? NO_WALLET : connectError.message}</p>}
      {w.switchError && <p className="notice notice--error" role="alert" style={{ width: '100%' }}>{w.switchError}</p>}
    </div>
  );
}
