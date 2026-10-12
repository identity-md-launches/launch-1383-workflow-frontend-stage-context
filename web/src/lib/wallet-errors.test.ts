import { describe, expect, it } from 'vitest';
import { errorText, NO_WALLET } from './format';

describe('wallet feedback', () => {
  it.each([
    { message: 'Provider not found. Version: fixture' },
    { shortMessage: 'Provider not available.', message: 'technical details' },
    new Error('ProviderNotFoundError: no injected provider'),
  ])('turns unavailable provider errors into installation guidance', (error) => {
    expect(errorText(error)).toBe(NO_WALLET);
  });
  it('keeps wallet rejection distinct from missing provider', () => {
    expect(errorText({ code: 4001, message: 'denied' })).toBe('You rejected the request in your wallet.');
  });
});
