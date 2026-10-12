import { encodeAbiParameters, keccak256 } from 'viem';
import type { PoolKey } from '../config';

export function poolIdOf(pool: PoolKey) {
  return keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }], [pool.currency0, pool.currency1, pool.fee, pool.tickSpacing, pool.hooks]));
}
/** Virtual reserves of the active liquidity, not the manager's balances shared by every pool. */
export function virtualReserves(liquidity: bigint, sqrtPriceX96: bigint) {
  if (sqrtPriceX96 <= 0n) return null;
  const q96 = 2n ** 96n;
  return { currency0: liquidity * q96 / sqrtPriceX96, currency1: liquidity * sqrtPriceX96 / q96 };
}
