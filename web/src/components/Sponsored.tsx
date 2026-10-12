import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { useAppConfig } from '../hooks';
import { shortAddress } from '../lib/format';

export interface Slot { buyer: Address; token: Address; paid: bigint; burned: boolean; headline: string; link: string }
const ZERO = '0x0000000000000000000000000000000000000000';

export function useSlot(day: number) {
  const cfg = useAppConfig();
  return useReadContract({
    address: cfg.frontPage.address, abi: cfg.frontPage.abi, functionName: 'slotOf', args: [BigInt(day)], chainId: cfg.chainId,
    query: { refetchInterval: 60_000, select: (d) => d as Slot },
  });
}

/** Today's sponsored slot, read from the contract and rendered as plain text. */
export function Sponsored({ day }: { day: number }) {
  const cfg = useAppConfig();
  const { data: slot, isLoading, error } = useSlot(day);
  const booked = slot && slot.buyer !== ZERO;
  return (
    <aside className="sponsored" aria-labelledby="sponsored-label">
      <span id="sponsored-label" className="sponsored__label">Sponsored</span>
      {isLoading && <p className="sponsored__meta">Reading today's slot from the contract…</p>}
      {error && <p className="sponsored__meta">Could not read today's slot: {error.message.slice(0, 120)}</p>}
      {slot && !booked && (
        <>
          <p className="sponsored__headline">This space is for sale.</p>
          <p className="sponsored__meta">Nobody booked today's front page. <a href="#/book">Book a day</a> for your coin.</p>
        </>
      )}
      {slot && booked && (
        <>
          <p className="sponsored__headline">{slot.headline}</p>
          <p className="sponsored__meta">
            Promoting <a className="mono" href={`${cfg.explorer}/token/${slot.token}`} target="_blank" rel="noreferrer">{shortAddress(slot.token)}</a>
            {slot.link && slot.link.startsWith('https://') && (
              <> · <a href={slot.link} target="_blank" rel="noreferrer nofollow">{slot.link}</a></>
            )}
          </p>
        </>
      )}
    </aside>
  );
}
