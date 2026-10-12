// Switching the wallet to the launch chain, adding it when the wallet does not know it.
import type { WalletAddChain } from '../config';

export interface Eip1193Like {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function isUnknownChainError(e: unknown): boolean {
  const any = e as { code?: number; data?: { originalError?: { code?: number } }; message?: string };
  if (any?.code === 4902 || any?.data?.originalError?.code === 4902) return true;
  const m = (any?.message ?? '').toLowerCase();
  return /unrecognized chain|unknown chain|not been added|try adding the chain|wallet_addethereumchain/.test(m);
}

/**
 * wallet_switchEthereumChain; on 4902 / unknown chain, wallet_addEthereumChain with the
 * handoff's walletAddChain, then switch again. Resolves when the switch succeeded, throws otherwise.
 */
export async function ensureChain(provider: Eip1193Like, chainId: number, addChain: WalletAddChain | null): Promise<void> {
  const hex = '0x' + chainId.toString(16);
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    return;
  } catch (e) {
    if (!isUnknownChainError(e) || !addChain) throw e;
  }
  await provider.request({ method: 'wallet_addEthereumChain', params: [addChain] });
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
}
