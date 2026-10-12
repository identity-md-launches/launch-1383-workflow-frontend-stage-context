import { describe, expect, it } from 'vitest';
import { decodeAbiParameters, decodeFunctionData, encodeFunctionData, type Address } from 'viem';
import { ACTIONS, COMMAND_V4_SWAP, UNIVERSAL_ROUTER_ABI, encodeSwapInputs, sides, spotFromSqrtPrice } from './swap';
import { applySlippage, fmtAmount, parseAmount, parseSlippage } from './format';

const poolKey = {
  currency0: '0x7094b1ba79e7eb3fab7caa8aa9b45976cd120807' as Address,
  currency1: '0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7' as Address,
  fee: 12500, tickSpacing: 60,
  hooks: '0x784ff9a3ac5d88a30bfff6f7f2a270161fbe6000' as Address,
};

describe('swap encoding', () => {
  it('encodes V4_SWAP with SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL', () => {
    const { commands, inputs } = encodeSwapInputs({ poolKey, zeroForOne: false, amountIn: 10n ** 18n, amountOutMinimum: 5n, extended: false });
    expect(commands).toBe(COMMAND_V4_SWAP);
    expect(inputs).toHaveLength(1);
    const [actions, params] = decodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], inputs[0]!);
    expect(actions).toBe(ACTIONS);
    expect(params).toHaveLength(3);
    const [swap] = decodeAbiParameters(
      [{ type: 'tuple', components: [
        { name: 'poolKey', type: 'tuple', components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }] },
        { name: 'zeroForOne', type: 'bool' }, { name: 'amountIn', type: 'uint128' }, { name: 'amountOutMinimum', type: 'uint128' }, { name: 'hookData', type: 'bytes' } ] }],
      params[0]!,
    );
    expect(swap.poolKey.hooks.toLowerCase()).toBe(poolKey.hooks);
    expect(swap.poolKey.fee).toBe(12500);
    expect(swap.zeroForOne).toBe(false);
    expect(swap.amountIn).toBe(10n ** 18n);
    const [settleCur, settleAmt] = decodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], params[1]!);
    expect(settleCur.toLowerCase()).toBe(poolKey.currency1); // buying SCOOP spends IMD (currency1)
    expect(settleAmt).toBe(10n ** 18n);
    const [takeCur, takeAmt] = decodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], params[2]!);
    expect(takeCur.toLowerCase()).toBe(poolKey.currency0);
    expect(takeAmt).toBe(5n);
  });
  it('extended tuple has six fields', () => {
    const words = (ext: boolean) => {
      const { inputs } = encodeSwapInputs({ poolKey, zeroForOne: true, amountIn: 1n, amountOutMinimum: 0n, extended: ext });
      const [, params] = decodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], inputs[0]!);
      return (params[0]!.length - 2) / 64;
    };
    // tuple offset + 5 poolKey words + bool + amountIn + amountOutMinimum + bytes offset + bytes length = 11; extended adds the uint256
    expect(words(false)).toBe(11);
    expect(words(true)).toBe(12);
  });
  it('builds execute calldata the router ABI decodes', () => {
    const { commands, inputs } = encodeSwapInputs({ poolKey, zeroForOne: true, amountIn: 7n, amountOutMinimum: 1n, extended: false });
    const data = encodeFunctionData({ abi: UNIVERSAL_ROUTER_ABI, functionName: 'execute', args: [commands, inputs, 123n] });
    const d = decodeFunctionData({ abi: UNIVERSAL_ROUTER_ABI, data });
    expect(d.functionName).toBe('execute');
    expect(d.args[2]).toBe(123n);
  });
  it('identifies the launch token side of the pool', () => {
    expect(sides(poolKey, poolKey.currency0)).toEqual({ tokenIsCurrency0: true, paired: poolKey.currency1 });
  });
  it('spot price from live sqrtPriceX96', () => {
    expect(spotFromSqrtPrice(127888275075207341070879257n)).toBeCloseTo(2.6056e-6, 9);
  });
});

describe('amounts', () => {
  it('formats and parses', () => {
    expect(fmtAmount(2_000_000n * 10n ** 18n)).toBe('2,000,000');
    expect(fmtAmount(1234567890000000000n, 18, 2)).toBe('1.23');
    expect(parseAmount('1.5')).toBe(1500000000000000000n);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('0')).toBeNull();
  });
  it('applies slippage in bps', () => {
    expect(applySlippage(10_000n, 50)).toBe(9_950n);
    expect(applySlippage(10_000n, 0)).toBe(10_000n);
  });
  it('rejects invalid slippage instead of treating it as zero protection', () => {
    for (const value of ['', ' ', 'abc', '1garbage', 'NaN', 'Infinity', '1e309', '-1', '50.01', '50.00001', '-0.00001', '-Infinity', '1e999', '100']) {
      expect(parseSlippage(value)).toBeNull();
    }
    expect(parseSlippage('0')).toBe(0);
    expect(parseSlippage('1.2')).toBe(120);
    expect(parseSlippage('50')).toBe(5000);
  });
});
