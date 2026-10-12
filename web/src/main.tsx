import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http, fallback } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem';
import { loadConfig, type AppConfig } from './config';
import { ConfigContext } from './hooks';
import { App } from './App';
import './styles.css';
import { ErrorBoundary, RetryNotice } from './components/Feedback';

const root = createRoot(document.getElementById('root')!);

function chainFrom(cfg: AppConfig) {
  const n = cfg.network;
  return defineChain({
    id: cfg.chainId,
    name: n?.name ?? `Chain ${cfg.chainId}`,
    nativeCurrency: n?.nativeCurrency ?? { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: n?.rpcUrls ?? [] } },
    blockExplorers: n ? { default: { name: 'Explorer', url: n.explorer } } : undefined,
    testnet: n?.testnet ?? false,
    contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } },
  });
}

async function boot() {
  try {
    const cfg = await loadConfig();
    const chain = chainFrom(cfg);
    const wagmi = createConfig({
      chains: [chain],
      connectors: [injected()],
      multiInjectedProviderDiscovery: true,
      transports: { [chain.id]: fallback([...new Set([...(cfg.network?.rpcUrls ?? []), 'https://rpc.flashbots.net', 'https://rpc.mevblocker.io'])].map((u) => http(u, { batch: { batchSize: 3 }, timeout: 8_000, retryCount: 0 })), { rank: false, retryCount: 1 }) },
    });
    const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });
    root.render(
      <StrictMode>
        <ConfigContext.Provider value={cfg}>
          <WagmiProvider config={wagmi}>
            <QueryClientProvider client={qc}>
              <ErrorBoundary><App /></ErrorBoundary>
            </QueryClientProvider>
          </WagmiProvider>
        </ConfigContext.Provider>
      </StrictMode>,
    );
  } catch {
    root.render(
      <main className="page">
        <h1>SCOOP</h1>
        <RetryNotice message="This page could not load. Try again." retry={boot} />
      </main>,
    );
  }
}

void boot();
