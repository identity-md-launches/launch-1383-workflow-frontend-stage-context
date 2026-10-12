import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';

const manifest = {
  version: 1, launchId: 'l', chainId: 1, sourceCommit: 'c', attestationHash: 'a',
  contracts: [
    { name: 'LaunchToken', address: '0x7094b1ba79e7eb3fab7caa8aa9b45976cd120807', abiHash: 'x', abiPath: 'abi/LaunchToken.json' },
    { name: 'ScoopFrontPage', address: '0xa94a5f4d0e737116b2d03133b88c130736e65947', abiHash: 'y', abiPath: 'abi/ScoopFrontPage.json' },
  ],
  assets: [], network: { chainId: 1, name: 'Ethereum', explorer: 'https://etherscan.io', rpcUrls: ['https://a'], uniswapV4: {}, pairToken: {} },
};

describe('runtime configuration', () => {
  it('reads addresses, chain and ABIs from imd-deployment.json only', async () => {
    const seen: string[] = [];
    const fetchImpl = (async (url: string) => {
      seen.push(url);
      const body = url.endsWith('imd-deployment.json') ? manifest : [{ type: 'function', name: 'price', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }];
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const cfg = await loadConfig(fetchImpl);
    expect(seen).toEqual(['./imd-deployment.json', './abi/LaunchToken.json', './abi/ScoopFrontPage.json']);
    expect(cfg.chainId).toBe(1);
    expect(cfg.frontPage.address).toBe('0xa94a5f4d0e737116b2d03133b88c130736e65947');
    expect(cfg.frontPage.abi).toHaveLength(1);
    expect(cfg.explorer).toBe('https://etherscan.io');
  });
  it('fails loudly when the manifest is missing', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
    await expect(loadConfig(fetchImpl)).rejects.toThrow(/imd-deployment.json/);
  });
});
