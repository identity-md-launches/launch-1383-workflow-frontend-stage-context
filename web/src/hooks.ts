import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import type { Abi, Address, Hash } from 'viem';
import type { AppConfig } from './config';
import { ensureChain, type Eip1193Like } from './lib/chain';
import { errorText } from './lib/format';

export const ConfigContext = createContext<AppConfig | null>(null);

export function useAppConfig(): AppConfig {
  const c = useContext(ConfigContext);
  if (!c) throw new Error('ConfigContext missing');
  return c;
}

/** Wallet state the whole app reasons about: connected, on the launch chain, can transact. */
export function useWallet() {
  const cfg = useAppConfig();
  const { address, isConnected, connector, chainId: walletChain } = useAccount();
  // useChainId falls back to a configured chain for unsupported networks. Key the client
  // by the connector's actual chain so a chainChanged event cannot reuse that stale client.
  const { data: walletClient } = useWalletClient({
    chainId: walletChain,
    query: { enabled: isConnected && walletChain === cfg.chainId },
  });
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const onChain = isConnected && walletChain === cfg.chainId && walletClient?.chain?.id === walletChain && walletClient?.account?.address.toLowerCase() === address?.toLowerCase();
  const switchToLaunchChain = useCallback(async () => {
    if (!connector) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      const provider = (await connector.getProvider()) as Eip1193Like;
      await ensureChain(provider, cfg.chainId, cfg.walletAddChain);
    } catch (e) {
      setSwitchError(errorText(e));
    } finally {
      setSwitching(false);
    }
  }, [connector, cfg.chainId, cfg.walletAddChain]);
  return { address, isConnected, chainId: walletChain, walletChain, onChain, switchToLaunchChain, switching, switchError, walletClient };
}

export type StepState = 'idle' | 'pending' | 'mining' | 'done' | 'error' | 'skipped';
export interface Step { label: string; state: StepState; hash?: Hash; detail?: string }

/** Runs an ordered list of wallet transactions, showing each as its own step with status. */
export function useTxRunner() {
  const publicClient = usePublicClient();
  const { walletClient, onChain } = useWallet();
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (plan: { label: string; skip?: () => Promise<boolean>; write: () => Promise<Hash> }[]) => {
      if (!walletClient || !publicClient) { setError('Connect a wallet first.'); return false; }
      if (!onChain) { setError('Switch to the launch network before continuing.'); return false; }
      setRunning(true); setError(null);
      const st: Step[] = plan.map((p) => ({ label: p.label, state: 'idle' }));
      setSteps([...st]);
      try {
        for (let i = 0; i < plan.length; i++) {
          const p = plan[i]!;
          if (p.skip && (await p.skip())) { st[i] = { ...st[i]!, state: 'skipped', detail: 'already satisfied' }; setSteps([...st]); continue; }
          st[i] = { ...st[i]!, state: 'pending', detail: 'confirm in wallet' }; setSteps([...st]);
          const hash = await p.write();
          st[i] = { ...st[i]!, state: 'mining', hash, detail: 'waiting for confirmation' }; setSteps([...st]);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status !== 'success') throw new Error(`Transaction ${hash} reverted on chain.`);
          st[i] = { ...st[i]!, state: 'done', hash, detail: `block ${receipt.blockNumber}` }; setSteps([...st]);
        }
        return true;
      } catch (e) {
        const idx = st.findIndex((s) => s.state === 'pending' || s.state === 'mining');
        if (idx >= 0) st[idx] = { ...st[idx]!, state: 'error' };
        setSteps([...st]);
        setError(errorText(e));
        return false;
      } finally {
        setRunning(false);
      }
    },
    [walletClient, publicClient, onChain],
  );
  const reset = useCallback(() => { setSteps([]); setError(null); }, []);
  return { steps, running, error, run, reset };
}

/** Current UTC seconds, ticking once a minute so day boundaries move without a reload. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 60_000); return () => clearInterval(t); }, []);
  return now;
}

export function useHashRoute(): string {
  const read = () => (window.location.hash.replace(/^#/, '') || '/');
  const [route, setRoute] = useState(read);
  useEffect(() => { const h = () => setRoute(read()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  return route;
}

export interface ContractRef { address: Address; abi: Abi }
