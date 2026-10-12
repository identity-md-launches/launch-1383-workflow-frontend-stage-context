import { useReadContract } from 'wagmi';
import { useAppConfig, useNow } from './hooks';
import { bookingWindow, dayIndex } from './lib/days';
import { poolIdOf, virtualReserves } from './lib/pool';
import { sides, STATE_VIEW_ABI, spotFromSqrtPrice } from './lib/swap';

export function useBookingTerms() {
  const cfg = useAppConfig();
  const clockDay = dayIndex(useNow());
  const base = { ...cfg.frontPage, chainId: cfg.chainId };
  const currentDay = useReadContract({ ...base, functionName: 'currentDay', query: { refetchInterval: 60_000, select: d => Number(d) } });
  const window = useReadContract({ ...base, functionName: 'bookingWindow', query: { refetchInterval: 60_000, select: d => d as [bigint, bigint] } });
  const price = useReadContract({ ...base, functionName: 'price', query: { refetchInterval: 60_000, select: d => d as bigint } });
  const today = !currentDay.isError && currentDay.data !== undefined ? currentDay.data : clockDay;
  const validWindow = !window.isError && window.data && Number(window.data[1]) >= Number(window.data[0]);
  const win = validWindow ? { first: Number(window.data![0]), last: Number(window.data![1]) } : bookingWindow(today);
  return { today, win, price, clockFallback: currentDay.isError || currentDay.data === undefined || !validWindow, retry: () => Promise.all([currentDay.refetch(), window.refetch(), price.refetch()]) };
}
export function usePool() {
  const cfg = useAppConfig(), net = cfg.network, pool = cfg.poolKey;
  const id = pool ? poolIdOf(pool) : undefined;
  const base = { address: net?.uniswapV4.stateView, abi: STATE_VIEW_ABI, args: [id!] as const, chainId: cfg.chainId, query: { enabled: !!id && !!net, refetchInterval: 20_000 } };
  const slot0 = useReadContract({ ...base, functionName: 'getSlot0' });
  const liquidity = useReadContract({ ...base, functionName: 'getLiquidity' });
  const tokenFirst = pool ? sides(pool, cfg.token.address).tokenIsCurrency0 : true;
  const rawSpot = slot0.data ? spotFromSqrtPrice(slot0.data[0]) : null;
  const spot = rawSpot && Number.isFinite(rawSpot) ? (tokenFirst ? rawSpot : 1 / rawSpot) : null;
  const raw = slot0.data && liquidity.data !== undefined ? virtualReserves(liquidity.data, slot0.data[0]) : null;
  const reserves = raw ? { scoop: tokenFirst ? raw.currency0 : raw.currency1, imd: tokenFirst ? raw.currency1 : raw.currency0 } : null;
  return { spot, reserves, error: slot0.error || liquidity.error, loading: slot0.isLoading || liquidity.isLoading, retry: () => Promise.all([slot0.refetch(), liquidity.refetch()]) };
}
