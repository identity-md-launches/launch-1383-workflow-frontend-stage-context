import { useConnect, useDisconnect } from 'wagmi';
import { useAppConfig, useWallet } from '../hooks';
import { shortAddress } from '../lib/format';

export function WalletBar() {
  const cfg = useAppConfig();
  const w = useWallet();
  const { connectors, connect, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const name = cfg.network?.name ?? `chain ${cfg.chainId}`;

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
        {!w.isConnected && connectors.length === 0 && <span className="notice notice--error" style={{ margin: 0 }}>No browser wallet found. Install an EIP-1193 wallet extension.</span>}
        {!w.isConnected && connectors.map((c) => (
          <button key={c.uid} className="btn btn--primary" disabled={isPending} onClick={() => connect({ connector: c })}>
            {isPending ? 'Connecting…' : `Connect ${c.name}`}
          </button>
        ))}
        {w.isConnected && !w.onChain && (
          <button className="btn btn--accent" disabled={w.switching} onClick={() => void w.switchToLaunchChain()}>
            {w.switching ? 'Switching…' : `Switch to ${name}`}
          </button>
        )}
        {w.isConnected && <button className="btn" onClick={() => disconnect()}>Disconnect</button>}
      </div>
      {connectError && <p className="notice notice--error" role="alert" style={{ width: '100%' }}>{connectError.message}</p>}
      {w.switchError && <p className="notice notice--error" role="alert" style={{ width: '100%' }}>{w.switchError}</p>}
    </div>
  );
}
