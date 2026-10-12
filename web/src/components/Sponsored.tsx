import { useReadContract } from 'wagmi';
import { isAddress, zeroAddress, type Address } from 'viem';
import { useAppConfig } from '../hooks';
import { fmtAmount } from '../lib/format';
import { dayToIso } from '../lib/days';
import { safeHttps } from '../lib/issues';
import { ERC20_ABI } from '../lib/swap';
import { useBookingTerms } from '../market';
import { RetryNotice } from './Feedback';

export interface Slot { buyer: Address; token: Address; paid: bigint; burned: boolean; headline: string; link: string }
export function useSlot(day: number) {
  const cfg = useAppConfig();
  return useReadContract({ ...cfg.frontPage, functionName: 'slotOf', args: [BigInt(day)], chainId: cfg.chainId, query: { refetchInterval: 60_000, select: d => d as Slot } });
}
export function AdCreative({ token, headline, link, preview = false }: { token: string; headline: string; link: string; preview?: boolean }) {
  const cfg = useAppConfig();
  const symbol = useReadContract({ address: isAddress(token) ? token : undefined, abi: ERC20_ABI, functionName: 'symbol', chainId: cfg.chainId, query: { enabled: isAddress(token) && token !== zeroAddress, staleTime: 300_000 } });
  const href = safeHttps(link);
  return <>
    <p className="sponsored__symbol">{symbol.data || (symbol.isError ? 'Token' : preview ? 'Your coin' : 'Reading token symbol…')}</p>
    {symbol.isError && <RetryNotice retry={symbol.refetch} />}
    <p className="sponsored__headline">{headline || 'Your headline, on the front page.'}</p>
    {href && <p className="sponsored__meta"><a href={href} target="_blank" rel="noreferrer nofollow sponsored">{new URL(href).hostname}</a><span className="ad-disclosure">External link, not checked by SCOOP</span></p>}
  </>;
}
export function AdPreview({ token, headline, link }: { token: string; headline: string; link: string }) {
  return <section className="ad-preview" aria-labelledby="preview-h"><h3 id="preview-h">Your ad, in print</h3><div className="sponsored"><span className="sponsored__label">Advertisement · Preview</span><AdCreative token={token} headline={headline} link={link} preview /></div></section>;
}
export function Sponsored({ day }: { day: number }) {
  const cfg = useAppConfig();
  const { data: slot, isLoading, error, refetch } = useSlot(day);
  const { win, price, retry: retryTerms } = useBookingTerms();
  const booked = slot && slot.buyer !== zeroAddress;
  const bookings = useReadContract({ ...cfg.frontPage, functionName: 'bookedDays', args: [BigInt(win.first), BigInt(win.last)], chainId: cfg.chainId, query: { enabled: !!slot && !booked, refetchInterval: 60_000, select: d => (d as bigint[]).map(Number) } });
  const freeDay = bookings.data ? Array.from({ length: win.last - win.first + 1 }, (_, i) => win.first + i).find(d => !bookings.data!.includes(d)) : undefined;
  return <aside className="sponsored" aria-label="Advertisement">
    <span className="sponsored__label">Advertisement</span>
    {isLoading && <p className="sponsored__meta">Reading today's advertisement…</p>}
    {error && <RetryNotice retry={refetch} />}
    {slot && !booked && <>
      <p className="sponsored__headline">Your coin on tomorrow's front page.</p>
      <p className="sponsored__meta">{price.data !== undefined ? `${fmtAmount(price.data)} SCOOP a day` : 'Reading the daily price…'}{freeDay !== undefined ? `, next free day ${dayToIso(freeDay)}.` : bookings.data ? '. All days in the current window are booked.' : '. Checking the next free day…'} <a className="house-book" href="#/book">Book →</a></p>
      {(price.error || bookings.error) && <RetryNotice retry={() => Promise.all([retryTerms(), bookings.refetch()])} />}
    </>}
    {slot && booked && <AdCreative token={slot.token} headline={slot.headline} link={slot.link} />}
  </aside>;
}
