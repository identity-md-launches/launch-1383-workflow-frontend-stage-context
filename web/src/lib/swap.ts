// Uniswap v4 swap encoding for the Universal Router (V4_SWAP with SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL).
import { encodeAbiParameters, type Address, type Hex } from 'viem';
import type { PoolKey } from '../config';

export const COMMAND_V4_SWAP: Hex = '0x10';
export const ACTIONS: Hex = '0x060c0f';

const POOL_KEY_COMPONENTS = [
  { name: 'currency0', type: 'address' },
  { name: 'currency1', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' },
  { name: 'hooks', type: 'address' },
] as const;

export interface SwapPlan {
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  extended: boolean; // network.uniswapV4.extendedSwapParams
}

export function inputCurrency(p: SwapPlan): Address {
  return p.zeroForOne ? p.poolKey.currency0 : p.poolKey.currency1;
}
export function outputCurrency(p: SwapPlan): Address {
  return p.zeroForOne ? p.poolKey.currency1 : p.poolKey.currency0;
}

export function encodeSwapInputs(p: SwapPlan): { commands: Hex; inputs: Hex[] } {
  const swapParams = p.extended
    ? encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'poolKey', type: 'tuple', components: POOL_KEY_COMPONENTS },
              { name: 'zeroForOne', type: 'bool' },
              { name: 'amountIn', type: 'uint128' },
              { name: 'amountOutMinimum', type: 'uint128' },
              { name: 'reserved', type: 'uint256' },
              { name: 'hookData', type: 'bytes' },
            ],
          },
        ],
        [{ poolKey: p.poolKey, zeroForOne: p.zeroForOne, amountIn: p.amountIn, amountOutMinimum: p.amountOutMinimum, reserved: 0n, hookData: '0x' }],
      )
    : encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'poolKey', type: 'tuple', components: POOL_KEY_COMPONENTS },
              { name: 'zeroForOne', type: 'bool' },
              { name: 'amountIn', type: 'uint128' },
              { name: 'amountOutMinimum', type: 'uint128' },
              { name: 'hookData', type: 'bytes' },
            ],
          },
        ],
        [{ poolKey: p.poolKey, zeroForOne: p.zeroForOne, amountIn: p.amountIn, amountOutMinimum: p.amountOutMinimum, hookData: '0x' }],
      );
  const settle = encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [inputCurrency(p), p.amountIn]);
  const take = encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [outputCurrency(p), p.amountOutMinimum]);
  const input0 = encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], [ACTIONS, [swapParams, settle, take]]);
  return { commands: COMMAND_V4_SWAP, inputs: [input0] };
}

export const ERC20_ABI = [
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

export const PERMIT2_ABI = [
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }, { name: 'token', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }], outputs: [] },
] as const;

export const QUOTER_ABI = [
  {
    type: 'function', name: 'quoteExactInputSingle', stateMutability: 'nonpayable',
    inputs: [{
      name: 'params', type: 'tuple', components: [
        { name: 'poolKey', type: 'tuple', components: POOL_KEY_COMPONENTS },
        { name: 'zeroForOne', type: 'bool' },
        { name: 'exactAmount', type: 'uint128' },
        { name: 'hookData', type: 'bytes' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }],
  },
] as const;

export const UNIVERSAL_ROUTER_ABI = [
  { type: 'function', name: 'execute', stateMutability: 'payable', inputs: [{ name: 'commands', type: 'bytes' }, { name: 'inputs', type: 'bytes[]' }, { name: 'deadline', type: 'uint256' }], outputs: [] },
] as const;

export const STATE_VIEW_ABI = [
  { type: 'function', name: 'getSlot0', stateMutability: 'view', inputs: [{ name: 'poolId', type: 'bytes32' }], outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' }] },
  { type: 'function', name: 'getLiquidity', stateMutability: 'view', inputs: [{ name: 'poolId', type: 'bytes32' }], outputs: [{ name: 'liquidity', type: 'uint128' }] },
] as const;

/** Spot price of currency1 per currency0 from sqrtPriceX96, as a JS number (display only). */
export function spotFromSqrtPrice(sqrtPriceX96: bigint, decimals0 = 18, decimals1 = 18): number {
  const p = Number(sqrtPriceX96) / 2 ** 96;
  return p * p * 10 ** (decimals0 - decimals1);
}

/** Permit2 allowance expiration: 30 days from now, as the uint48 the router checks. */
export function permit2Expiration(nowSeconds: number): number {
  return nowSeconds + 30 * 86_400;
}

/** Which of the pool's currencies is the launch token, and which is the paired currency. */
export function sides(poolKey: PoolKey, token: Address): { tokenIsCurrency0: boolean; paired: Address } {
  const tokenIsCurrency0 = poolKey.currency0.toLowerCase() === token.toLowerCase();
  return { tokenIsCurrency0, paired: tokenIsCurrency0 ? poolKey.currency1 : poolKey.currency0 };
}
