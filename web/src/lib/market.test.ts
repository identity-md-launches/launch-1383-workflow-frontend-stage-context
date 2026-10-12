import { describe, it, expect } from 'vitest';
import { parseEther } from 'viem';
import { fmtAmount, fmtNumber, errorText, NETWORK_ERROR, applySlippage } from './format';
import { virtualReserves } from './pool';

describe('readable pool values', () => {
  it('groups large exchange rates without scientific notation', () => {
    expect(fmtNumber(354200)).toBe('354,200');
    expect(fmtNumber(1 / 354200)).not.toMatch(/e[+-]/);
  });
  it('shows a one-SCOOP sell quote and its minimum accurately', () => {
    const out = parseEther('0.000002606');
    expect(fmtAmount(out)).toBe('0.000002606');
    expect(fmtAmount(applySlippage(out, 100))).toBe('0.000002579');
    expect(fmtAmount(1n)).toBe('0.000000000000000001');
  });
  it('derives active virtual reserves in currency order', () => {
    expect(virtualReserves(1000n, 2n ** 97n)).toEqual({ currency0: 500n, currency1: 2000n });
    expect(virtualReserves(1000n, 0n)).toBeNull();
  });
});
describe('safe errors', () => {
  it.each([new Error('HTTP 503 / secret RPC payload / viem version'), { shortMessage: 'raw library text' }, null, 'private details', { message: 'Fetch failed', cause: { message: 'invalid key' } }])('never exposes raw RPC/library error text', value => expect(errorText(value)).toBe(NETWORK_ERROR));
  it('recognizes a nested wallet rejection', () => expect(errorText({ cause: { code: 4001 } })).toBe('You rejected the request in your wallet.'));
});
