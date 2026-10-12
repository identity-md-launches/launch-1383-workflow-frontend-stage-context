// Mirrors ScoopFrontPage's on-chain checks so the form can refuse before the wallet does.
import { isAddress, getAddress } from 'viem';

export const MAX_HEADLINE = 80;
export const MAX_LINK = 120;

function printableAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}

export function headlineError(headline: string): string | null {
  if (headline.length < 1) return 'Write a headline.';
  if (headline.length > MAX_HEADLINE) return `Headline is ${headline.length} characters; the limit is ${MAX_HEADLINE}.`;
  if (!printableAscii(headline)) return 'Headline may only use printable ASCII (letters, digits, punctuation, spaces).';
  return null;
}

export function linkError(link: string): string | null {
  if (link.length === 0) return null;
  if (!link.startsWith('https://')) return 'Link must start with https:// or be left empty.';
  if (link.length > MAX_LINK) return `Link is ${link.length} characters; the limit is ${MAX_LINK}.`;
  if (!printableAscii(link)) return 'Link may only use printable ASCII.';
  return null;
}

export function tokenError(token: string): string | null {
  if (token.trim() === '') return 'Enter the address of the coin you are promoting.';
  if (!isAddress(token.trim(), { strict: false })) return 'That is not a valid 0x address.';
  if (/^0x0{40}$/i.test(token.trim())) return 'The zero address cannot be promoted.';
  return null;
}

export function checksum(address: string): string {
  return getAddress(address.trim());
}
