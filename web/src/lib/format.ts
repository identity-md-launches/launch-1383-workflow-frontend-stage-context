import { formatUnits, parseUnits } from 'viem';

/** Format token minor units with thousands separators and at most `maxFraction` decimals. */
export function fmtAmount(value: bigint | undefined, decimals = 18, maxFraction = 4): string {
  if (value === undefined) return '—';
  const s = formatUnits(value, decimals);
  const [int, frac = ''] = s.split('.');
  const intFmt = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const f = frac.slice(0, maxFraction).replace(/0+$/, '');
  return f ? `${intFmt}.${f}` : intFmt;
}

/** Parse a user-typed decimal amount; returns null for empty/invalid. */
export function parseAmount(text: string, decimals = 18): bigint | null {
  const t = text.trim();
  if (!/^\d*(\.\d*)?$/.test(t) || t === '' || t === '.') return null;
  try {
    const v = parseUnits(t, decimals);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

export function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** Apply slippage in basis points to a quoted output: minimum acceptable amount. */
export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(10_000, Math.round(slippageBps))));
  return (amountOut * (10_000n - bps)) / 10_000n;
}

/** Human readable error from a wallet / viem rejection. */
export function errorText(e: unknown): string {
  if (!e) return 'Unknown error';
  const any = e as { shortMessage?: string; message?: string; code?: number; cause?: unknown };
  if (any.code === 4001 || /user rejected|user denied/i.test(any.shortMessage ?? any.message ?? '')) {
    return 'You rejected the request in your wallet.';
  }
  const m = any.shortMessage ?? any.message ?? String(e);
  return m.length > 300 ? m.slice(0, 300) + '…' : m;
}
