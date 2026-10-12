import { useMemo, useState } from 'react';
import { usePublicClient, useReadContract, useReadContracts } from 'wagmi';
import { type Address, zeroAddress } from 'viem';
import { useAppConfig, useNow, useTxRunner, useWallet } from '../hooks';
import { bookingWindow, dayHasEnded, dayHasStarted, dayIndex, dayToIso, longDate, shortDate, weekdayShort } from '../lib/days';
import { fmtAmount, parseAmount, shortAddress, errorText } from '../lib/format';
import { checksum, headlineError, linkError, tokenError, MAX_HEADLINE, MAX_LINK } from '../lib/validate';
import { ERC20_ABI } from '../lib/swap';
import { Steps } from './Steps';
import type { Slot } from './Sponsored';

export function Book() {
  const cfg = useAppConfig();
  const w = useWallet();
  const now = useNow();
  const today = dayIndex(now);
  const win = bookingWindow(today);
  const fp = cfg.frontPage;

  const price = useReadContract({ address: fp.address, abi: fp.abi, functionName: 'price', chainId: cfg.chainId, query: { refetchInterval: 60_000, select: (d) => d as bigint } });
  const nextPrice = useReadContract({ address: fp.address, abi: fp.abi, functionName: 'nextPrice', chainId: cfg.chainId, query: { refetchInterval: 60_000, select: (d) => d as [bigint, bigint] } });
  const owner = useReadContract({ address: fp.address, abi: fp.abi, functionName: 'owner', chainId: cfg.chainId, query: { select: (d) => d as Address } });
  const pendingOwner = useReadContract({ address: fp.address, abi: fp.abi, functionName: 'pendingOwner', chainId: cfg.chainId, query: { select: (d) => d as Address } });
  // Booked days from 31 days ago (burnable) to 30 days ahead (bookable): one call.
  const from = today - 31;
  const bookedDays = useReadContract({
    address: fp.address, abi: fp.abi, functionName: 'bookedDays', args: [BigInt(from), BigInt(win.last)], chainId: cfg.chainId,
    query: { refetchInterval: 30_000, select: (d) => (d as bigint[]).map(Number) },
  });
  const booked = useMemo(() => new Set(bookedDays.data ?? []), [bookedDays.data]);
  const slots = useReadContracts({
    contracts: (bookedDays.data ?? []).map((d) => ({ address: fp.address, abi: fp.abi, functionName: 'slotOf', args: [BigInt(d)], chainId: cfg.chainId })),
    query: { enabled: (bookedDays.data?.length ?? 0) > 0, refetchInterval: 30_000 },
  });
  const slotList = useMemo(() => {
    const list: { day: number; slot: Slot }[] = [];
    (bookedDays.data ?? []).forEach((d, i) => { const r = slots.data?.[i]; if (r && r.status === 'success') list.push({ day: d, slot: r.result as Slot }); });
    return list;
  }, [bookedDays.data, slots.data]);

  const balance = useReadContract({ address: cfg.token.address, abi: ERC20_ABI, functionName: 'balanceOf', args: [w.address ?? zeroAddress], chainId: cfg.chainId, query: { enabled: !!w.address, refetchInterval: 30_000 } });
  const allowance = useReadContract({ address: cfg.token.address, abi: ERC20_ABI, functionName: 'allowance', args: [w.address ?? zeroAddress, fp.address], chainId: cfg.chainId, query: { enabled: !!w.address, refetchInterval: 30_000 } });

  const [day, setDay] = useState<number | null>(null);
  const [token, setToken] = useState('');
  const [headline, setHeadline] = useState('');
  const [link, setLink] = useState('');
  const [touched, setTouched] = useState(false);
  const tErr = tokenError(token), hErr = headlineError(headline), lErr = linkError(link);
  const dayErr = day === null ? 'Pick a day.' : booked.has(day) ? 'That day is already booked.' : day < win.first || day > win.last ? 'That day is outside the booking window.' : null;
  const formValid = !tErr && !hErr && !lErr && !dayErr;
  const tx = useTxRunner();
  const publicClient = usePublicClient();
  const [simError, setSimError] = useState<string | null>(null);

  const canTransact = w.onChain && !!w.walletClient;
  const needPrice = price.data ?? 0n;
  const enough = balance.data !== undefined && balance.data >= needPrice;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!formValid || !canTransact || !w.walletClient || !w.address || day === null || !publicClient) return;
    setSimError(null);
    const tokenAddr = checksum(token) as Address;
    const amount = needPrice;
    const ok = await tx.run([
      {
        label: `Approve ${fmtAmount(amount)} SCOOP to the front page`,
        skip: async () => { const a = await publicClient.readContract({ address: cfg.token.address, abi: ERC20_ABI, functionName: 'allowance', args: [w.address!, fp.address] }); return a >= amount; },
        write: () => w.walletClient!.writeContract({ address: cfg.token.address, abi: ERC20_ABI, functionName: 'approve', args: [fp.address, amount], chain: w.walletClient!.chain, account: w.address! }),
      },
      {
        label: `Book ${dayToIso(day)} for ${fmtAmount(amount)} SCOOP`,
        write: async () => {
          try {
            const { request } = await publicClient.simulateContract({ address: fp.address, abi: fp.abi, functionName: 'book', args: [BigInt(day), tokenAddr, headline, link], account: w.address! });
            return await w.walletClient!.writeContract(request);
          } catch (err) { setSimError(errorText(err)); throw err; }
        },
      },
    ]);
    if (ok) { void bookedDays.refetch(); void balance.refetch(); void allowance.refetch(); setDay(null); setHeadline(''); setLink(''); setToken(''); setTouched(false); }
  };

  const mine = slotList.filter((s) => w.address && s.slot.buyer.toLowerCase() === w.address.toLowerCase());
  const burnable = slotList.filter((s) => dayHasEnded(s.day, now) && !s.slot.burned);
  const isOwner = !!w.address && !!owner.data && owner.data.toLowerCase() === w.address.toLowerCase();
  const isPending = !!w.address && !!pendingOwner.data && pendingOwner.data.toLowerCase() === w.address.toLowerCase();
  const days = Array.from({ length: 30 }, (_, i) => win.first + i);

  return (
    <>
      <section className="section" aria-labelledby="book-h">
        <p className="section__kicker">Sponsored slot</p>
        <h2 id="book-h">Book the front page</h2>
        <div className="columns columns--main">
          <div>
            <p className="prose">One sponsored slot per UTC day, from tomorrow up to 30 days ahead, first come first served. The price is pulled in SCOOP when you book and held by the contract. After the day ends anyone can burn it. The owner can veto a booking before its day starts, which refunds you in full.</p>
            <dl className="kv">
              <dt>Price today</dt><dd className="num">{price.isLoading ? 'reading…' : price.error ? 'unavailable' : `${fmtAmount(price.data)} SCOOP`}</dd>
              {nextPrice.data && nextPrice.data[1] > BigInt(today) && (<><dt>From {dayToIso(Number(nextPrice.data[1]))}</dt><dd className="num">{fmtAmount(nextPrice.data[0])} SCOOP</dd></>)}
              <dt>Window</dt><dd>{shortDate(win.first)} to {shortDate(win.last)} (UTC)</dd>
              {w.address && (<><dt>Your SCOOP</dt><dd className="num">{fmtAmount(balance.data)} SCOOP</dd></>)}
              {w.address && (<><dt>Approved</dt><dd className="num">{fmtAmount(allowance.data)} SCOOP</dd></>)}
            </dl>
          </div>
          <div className="card">
            {!w.isConnected && <p>Connect a wallet to book. You can browse the calendar without one.</p>}
            {w.isConnected && !w.onChain && <p>Switch to {cfg.network?.name ?? `chain ${cfg.chainId}`} to book.</p>}
            {w.onChain && !enough && balance.data !== undefined && <p>You hold {fmtAmount(balance.data)} SCOOP; a slot costs {fmtAmount(needPrice)} SCOOP. <a href="#/trade">Buy SCOOP</a>.</p>}
            {w.onChain && enough && <p>Ready: approve, then book. Two wallet confirmations.</p>}
          </div>
        </div>

        <form onSubmit={(e) => void submit(e)} noValidate>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field" style={{ marginBottom: 0 }}><span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600 }}>Pick a day (UTC)</span></legend>
            <p className="legend">Booked days are crossed out. {bookedDays.isLoading ? 'Reading bookings…' : bookedDays.error ? 'Could not read bookings.' : `${days.filter((d) => booked.has(d)).length} of 30 booked.`}</p>
            <ul className="calendar">
              {days.map((d) => (
                <li key={d}>
                  <button type="button" className="day" aria-pressed={day === d} disabled={booked.has(d)} onClick={() => setDay(d)} aria-label={`${longDate(d)}${booked.has(d) ? ', booked' : ''}`}>
                    <small>{weekdayShort(d)}</small>{shortDate(d)}
                  </button>
                </li>
              ))}
            </ul>
            {touched && dayErr && <p className="error" role="alert" style={{ fontFamily: 'var(--font-sans)', color: 'var(--red)' }}>{dayErr}</p>}
          </fieldset>
          <div className="columns">
            <div className="field">
              <label htmlFor="token">Coin you are promoting (address)</label>
              <input id="token" type="text" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} aria-invalid={touched && !!tErr} aria-describedby="token-hint token-err" placeholder="0x…" />
              <span id="token-hint" className="hint">Any ERC-20 address on {cfg.network?.name ?? 'this chain'}.</span>
              {touched && tErr && <span id="token-err" className="error">{tErr}</span>}
            </div>
            <div className="field">
              <label htmlFor="headline">Headline</label>
              <input id="headline" type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={MAX_HEADLINE} aria-invalid={touched && !!hErr} aria-describedby="headline-hint headline-err" />
              <span id="headline-hint" className="hint num">{headline.length}/{MAX_HEADLINE} printable ASCII characters. Shown as plain text.</span>
              {touched && hErr && <span id="headline-err" className="error">{hErr}</span>}
            </div>
            <div className="field">
              <label htmlFor="link">Link (optional)</label>
              <input id="link" type="url" value={link} onChange={(e) => setLink(e.target.value)} maxLength={MAX_LINK} aria-invalid={touched && !!lErr} aria-describedby="link-hint link-err" placeholder="https://" />
              <span id="link-hint" className="hint num">{link.length}/{MAX_LINK}. Must start with https:// or stay empty.</span>
              {touched && lErr && <span id="link-err" className="error">{lErr}</span>}
            </div>
          </div>
          <div className="row">
            <button type="submit" className="btn btn--accent" disabled={!canTransact || tx.running || !enough || price.data === undefined}>
              {tx.running ? 'Working…' : day !== null ? `Approve and book ${dayToIso(day)} for ${fmtAmount(needPrice)} SCOOP` : 'Approve and book'}
            </button>
            {tx.steps.length > 0 && !tx.running && <button type="button" className="btn" onClick={tx.reset}>Clear</button>}
          </div>
          {simError && <p className="notice notice--error" role="alert">The booking would revert: {simError}</p>}
          <Steps steps={tx.steps} error={tx.error && !simError ? tx.error : null} />
        </form>
      </section>

      <section className="section" aria-labelledby="mine-h">
        <p className="section__kicker">Your bookings</p>
        <h2 id="mine-h">Days you booked</h2>
        {!w.address && <p>Connect a wallet to see your bookings.</p>}
        {w.address && mine.length === 0 && <p>No bookings from {shortAddress(w.address)} in the last 31 or next 30 days.</p>}
        {mine.length > 0 && <BookingTable rows={mine} now={now} />}
      </section>

      <section className="section" aria-labelledby="burn-h">
        <p className="section__kicker">Ledger</p>
        <h2 id="burn-h">Bookings on the books</h2>
        <p className="prose">Every booking in the window, past and future. Once a day has ended, anyone can send its held SCOOP to the burn address.</p>
        {slotList.length === 0 && <p>No bookings in the window.</p>}
        {slotList.length > 0 && <BookingTable rows={slotList} now={now} burnable={burnable} />}
      </section>

      {(isOwner || isPending) && (
        <section className="section" aria-labelledby="owner-h">
          <p className="section__kicker">Owner</p>
          <h2 id="owner-h">Editor's desk</h2>
          <OwnerPanel isOwner={isOwner} isPending={isPending} pendingOwner={pendingOwner.data} future={slotList.filter((s) => !dayHasStarted(s.day, now))} onDone={() => { void bookedDays.refetch(); void price.refetch(); void nextPrice.refetch(); void owner.refetch(); void pendingOwner.refetch(); }} />
        </section>
      )}
    </>
  );
}

function BookingTable({ rows, now, burnable }: { rows: { day: number; slot: Slot }[]; now: number; burnable?: { day: number }[] }) {
  const cfg = useAppConfig();
  const w = useWallet();
  const tx = useTxRunner();
  const burnSet = new Set((burnable ?? []).map((b) => b.day));
  const burn = async (day: number) => {
    if (!w.walletClient || !w.address) return;
    await tx.run([{ label: `Burn the SCOOP held for ${dayToIso(day)}`, write: () => w.walletClient!.writeContract({ address: cfg.frontPage.address, abi: cfg.frontPage.abi, functionName: 'burn', args: [BigInt(day)], chain: w.walletClient!.chain, account: w.address! }) }]);
  };
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th scope="col">Day</th><th scope="col">Headline</th><th scope="col">Coin</th><th scope="col">Buyer</th><th scope="col">Paid</th><th scope="col">State</th></tr></thead>
        <tbody>
          {rows.map(({ day, slot }) => {
            const state = slot.burned ? 'burned' : dayHasEnded(day, now) ? 'ended, not burned' : dayHasStarted(day, now) ? 'live today' : 'upcoming';
            return (
              <tr key={day}>
                <td className="num">{dayToIso(day)}</td>
                <td>{slot.headline}</td>
                <td><a className="mono" href={`${cfg.explorer}/token/${slot.token}`} target="_blank" rel="noreferrer">{shortAddress(slot.token)}</a></td>
                <td><span className="mono">{shortAddress(slot.buyer)}</span></td>
                <td className="num">{fmtAmount(slot.paid)} SCOOP</td>
                <td>
                  {state}
                  {burnable && burnSet.has(day) && (
                    <> <button className="btn btn--small" disabled={!w.onChain || tx.running} onClick={() => void burn(day)} title={w.onChain ? undefined : 'Connect on the launch chain to burn'}>Burn</button></>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Steps steps={tx.steps} error={tx.error} />
    </div>
  );
}

function OwnerPanel({ isOwner, isPending, pendingOwner, future, onDone }: { isOwner: boolean; isPending: boolean; pendingOwner?: Address; future: { day: number; slot: Slot }[]; onDone: () => void }) {
  const cfg = useAppConfig();
  const w = useWallet();
  const tx = useTxRunner();
  const [priceText, setPriceText] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const fp = cfg.frontPage;
  const write = (functionName: string, args: unknown[]) => w.walletClient!.writeContract({ address: fp.address, abi: fp.abi, functionName, args, chain: w.walletClient!.chain, account: w.address! });
  const parsed = parseAmount(priceText);
  const ownerErr = newOwner ? tokenError(newOwner) : null;
  return (
    <div className="stack">
      {isPending && (
        <div className="card">
          <p>This wallet is the pending owner. Accept to complete the two-step handover.</p>
          <button className="btn btn--accent" disabled={!w.onChain || tx.running} onClick={() => void tx.run([{ label: 'Accept ownership', write: () => write('acceptOwnership', []) }]).then(onDone)}>Accept ownership</button>
        </div>
      )}
      {isOwner && (
        <>
          <div className="card">
            <h3>Schedule a new price</h3>
            <p>Applies from the next UTC day. Bookings made today still pay today's price.</p>
            <div className="field">
              <label htmlFor="newprice">New price (SCOOP)</label>
              <input id="newprice" type="text" inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} aria-describedby="newprice-hint" />
              <span id="newprice-hint" className="hint">Whole or decimal SCOOP, for example 1500000.</span>
            </div>
            <button className="btn btn--primary" disabled={!w.onChain || tx.running || parsed === null} onClick={() => void tx.run([{ label: `Set price to ${fmtAmount(parsed ?? 0n)} SCOOP from tomorrow`, write: () => write('setPrice', [parsed]) }]).then(onDone)}>Schedule price</button>
          </div>
          <div className="card">
            <h3>Veto an upcoming booking</h3>
            <p>Only before the day starts. The buyer is refunded in full and the day is freed.</p>
            {future.length === 0 && <p>No upcoming bookings.</p>}
            {future.length > 0 && (
              <ul className="steps">
                {future.map(({ day, slot }) => (
                  <li key={day}>
                    <span><span className="num">{dayToIso(day)}</span> — {slot.headline} — {shortAddress(slot.buyer)}</span>
                    <button className="btn btn--small" disabled={!w.onChain || tx.running} onClick={() => { if (window.confirm(`Veto ${dayToIso(day)} and refund ${fmtAmount(slot.paid)} SCOOP to ${slot.buyer}?`)) void tx.run([{ label: `Veto ${dayToIso(day)}`, write: () => write('veto', [BigInt(day)]) }]).then(onDone); }}>Veto</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h3>Hand over ownership</h3>
            <p>Two steps: you propose, the new owner accepts. {pendingOwner && pendingOwner !== zeroAddress && <>Pending: <span className="mono">{pendingOwner}</span>.</>}</p>
            <div className="field">
              <label htmlFor="newowner">New owner address</label>
              <input id="newowner" type="text" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} aria-invalid={!!ownerErr} aria-describedby="newowner-err" placeholder="0x…" />
              {ownerErr && <span id="newowner-err" className="error">{ownerErr}</span>}
            </div>
            <button className="btn" disabled={!w.onChain || tx.running || !newOwner || !!ownerErr} onClick={() => { if (window.confirm(`Propose ${newOwner} as the new owner?`)) void tx.run([{ label: 'Propose new owner', write: () => write('transferOwnership', [checksum(newOwner)]) }]).then(onDone); }}>Propose new owner</button>
          </div>
        </>
      )}
      <Steps steps={tx.steps} error={tx.error} />
    </div>
  );
}
