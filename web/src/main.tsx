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
      transports: { [chain.id]: fallback((cfg.network?.rpcUrls ?? []).map((u) => http(u, { batch: true }))) },
    });
    const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });
    root.render(
      <StrictMode>
        <ConfigContext.Provider value={cfg}>
          <WagmiProvider config={wagmi}>
            <QueryClientProvider client={qc}>
              <App />
            </QueryClientProvider>
          </WagmiProvider>
        </ConfigContext.Provider>
      </StrictMode>,
    );
  } catch (e) {
    root.render(
      <main className="page">
        <h1>SCOOP</h1>
        <p className="notice notice--error" role="alert">
          The site could not load its deployment configuration: {(e as Error).message}
        </p>
      </main>,
    );
  }
}

void boot();
