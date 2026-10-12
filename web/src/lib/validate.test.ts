import { describe, expect, it } from 'vitest';
import { headlineError, linkError, tokenError } from './validate';

describe('form validation mirrors the contract', () => {
  it('headline 1-80 printable ASCII', () => {
    expect(headlineError('')).not.toBeNull();
    expect(headlineError('a')).toBeNull();
    expect(headlineError('x'.repeat(80))).toBeNull();
    expect(headlineError('x'.repeat(81))).not.toBeNull();
    expect(headlineError('tab\there')).not.toBeNull();
    expect(headlineError('émoji')).not.toBeNull();
  });
  it('link empty or https:// up to 120', () => {
    expect(linkError('')).toBeNull();
    expect(linkError('http://x.y')).not.toBeNull();
    expect(linkError('https://x.y')).toBeNull();
    expect(linkError('https://' + 'a'.repeat(112))).toBeNull();
    expect(linkError('https://' + 'a'.repeat(113))).not.toBeNull();
  });
  it('token must be a non-zero address', () => {
    expect(tokenError('')).not.toBeNull();
    expect(tokenError('0x1234')).not.toBeNull();
    expect(tokenError('0x0000000000000000000000000000000000000000')).not.toBeNull();
    expect(tokenError('0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7')).toBeNull();
  });
});
