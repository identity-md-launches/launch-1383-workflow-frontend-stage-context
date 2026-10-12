import { formatUnits, parseUnits } from 'viem';

/** Format token minor units with thousands separators and at most `maxFraction` decimals. */
export function fmtAmount(value: bigint | undefined, decimals = 18, maxFraction = 4): string {
  if (value === undefined) return '—';
  const s = formatUnits(value, decimals);
  const [int, frac = ''] = s.split('.');
  const intFmt = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Show the first four significant fractional digits for tiny positive amounts.
  const first = frac.search(/[1-9]/);
  const precision = int === '0' && first >= 0 ? Math.max(maxFraction, first + 4) : maxFraction;
  const f = frac.slice(0, precision).replace(/0+$/, '');
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

/** Validate the displayed 0–50% range before converting to basis points. */
export function parseSlippage(text: string): number | null {
  const value = Number(text);
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 50
    ? Math.round(value * 100) : null;
}

/** Apply a validated slippage in basis points to a quoted output. */
export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(10_000, Math.round(slippageBps))));
  return (amountOut * (10_000n - bps)) / 10_000n;
}

export const NO_WALLET = 'No wallet found. Open this site in a wallet browser or install a browser wallet.';

/** Display-only pool figures: grouped digits, never exponent notation. */
export function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 7, useGrouping: true }).format(value);
}
export const NETWORK_ERROR = 'Could not reach Ethereum right now. Try again.';
/** Only approved messages reach the interface; RPC and wallet internals stay private. */
export function errorText(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; code?: number; cause?: unknown } | null;
  const message = err?.shortMessage ?? err?.message ?? '';
  if (/provider.*not (found|available)|ProviderNotFound/i.test(message)) return NO_WALLET;
  if (err?.code === 4001 || /user rejected|user denied/i.test(message)) return 'You rejected the request in your wallet.';
  if (err?.cause && err.cause !== e) {
    const nested = errorText(err.cause);
    if (nested !== NETWORK_ERROR) return nested;
  }
  return NETWORK_ERROR;
}
