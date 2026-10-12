import { describe, expect, it } from 'vitest';
import { ensureChain } from './chain';

const addChain = {
  chainId: '0x1', chainName: 'Ethereum', rpcUrls: ['https://ethereum-rpc.publicnode.com'],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://etherscan.io'],
};

function mockProvider(behaviour: (method: string, calls: number) => unknown) {
  const calls: { method: string; params?: unknown[] }[] = [];
  return {
    calls,
    request: async (args: { method: string; params?: unknown[] }) => {
      calls.push(args);
      const r = behaviour(args.method, calls.length);
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

describe('ensureChain', () => {
  it('switches directly when the wallet knows the chain', async () => {
    const p = mockProvider(() => null);
    await ensureChain(p, 1, addChain);
    expect(p.calls.map((c) => c.method)).toEqual(['wallet_switchEthereumChain']);
    expect(p.calls[0]!.params).toEqual([{ chainId: '0x1' }]);
  });
  it('adds the chain on 4902 then switches again', async () => {
    const p = mockProvider((m, n) => (m === 'wallet_switchEthereumChain' && n === 1 ? Object.assign(new Error('Unrecognized chain ID'), { code: 4902 }) : null));
    await ensureChain(p, 1, addChain);
    expect(p.calls.map((c) => c.method)).toEqual(['wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain']);
    expect(p.calls[1]!.params).toEqual([addChain]);
  });
  it('rethrows a user rejection without adding', async () => {
    const p = mockProvider(() => Object.assign(new Error('User rejected the request.'), { code: 4001 }));
    await expect(ensureChain(p, 1, addChain)).rejects.toThrow(/rejected/);
    expect(p.calls).toHaveLength(1);
  });
  it('rethrows unknown-chain when no walletAddChain is configured', async () => {
    const p = mockProvider(() => Object.assign(new Error('x'), { code: 4902 }));
    await expect(ensureChain(p, 1, null)).rejects.toBeTruthy();
    expect(p.calls).toHaveLength(1);
  });
});
