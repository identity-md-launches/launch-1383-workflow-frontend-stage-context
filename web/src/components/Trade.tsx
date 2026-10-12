import { useEffect, useState } from 'react';
import { usePublicClient, useReadContract } from 'wagmi';
import { encodeAbiParameters, keccak256, maxUint160, zeroAddress } from 'viem';
import { useAppConfig, useNow, useTxRunner, useWallet } from '../hooks';
import { applySlippage, errorText, fmtAmount, parseAmount } from '../lib/format';
import { ERC20_ABI, PERMIT2_ABI, QUOTER_ABI, STATE_VIEW_ABI, UNIVERSAL_ROUTER_ABI, encodeSwapInputs, permit2Expiration, sides, spotFromSqrtPrice } from '../lib/swap';
import { Steps } from './Steps';
import { CopyAddress } from './Footer';

export function Trade() {
  const cfg = useAppConfig();
  const w = useWallet();
  const now = useNow();
  const publicClient = usePublicClient();
  const net = cfg.network;
  const poolKey = cfg.poolKey;
  const tradingEnabled = !!net && !!poolKey;
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amountText, setAmountText] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [quote, setQuote] = useState<{ out: bigint; forIn: bigint } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const tx = useTxRunner();

  const token = cfg.token.address;
  const pair = net?.pairToken;
  const s = poolKey ? sides(poolKey, token) : null;
  // buy SCOOP: paired currency in; sell: SCOOP in.
  const inAddr = side === 'buy' ? (pair?.address ?? zeroAddress) : token;
  const outAddr = side === 'buy' ? token : (pair?.address ?? zeroAddress);
  const inSym = side === 'buy' ? (pair?.symbol ?? '?') : 'SCOOP';
  const outSym = side === 'buy' ? 'SCOOP' : (pair?.symbol ?? '?');
  const zeroForOne = s ? (side === 'sell' ? s.tokenIsCurrency0 : !s.tokenIsCurrency0) : false;
  const amountIn = parseAmount(amountText);
  const slippageBps = Math.round((parseFloat(slippage) || 0) * 100);

  const poolId = poolKey ? keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }], [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks])) : undefined;
  const slot0 = useReadContract({ address: net?.uniswapV4.stateView, abi: STATE_VIEW_ABI, functionName: 'getSlot0', args: [poolId!], chainId: cfg.chainId, query: { enabled: !!poolId && !!net, refetchInterval: 30_000 } });
  const liquidity = useReadContract({ address: net?.uniswapV4.stateView, abi: STATE_VIEW_ABI, functionName: 'getLiquidity', args: [poolId!], chainId: cfg.chainId, query: { enabled: !!poolId && !!net, refetchInterval: 30_000 } });
  const balIn = useReadContract({ address: inAddr, abi: ERC20_ABI, functionName: 'balanceOf', args: [w.address ?? zeroAddress], chainId: cfg.chainId, query: { enabled: !!w.address && inAddr !== zeroAddress, refetchInterval: 30_000 } });
  const balOut = useReadContract({ address: outAddr, abi: ERC20_ABI, functionName: 'balanceOf', args: [w.address ?? zeroAddress], chainId: cfg.chainId, query: { enabled: !!w.address && outAddr !== zeroAddress, refetchInterval: 30_000 } });
  const supply = useReadContract({ address: token, abi: ERC20_ABI, functionName: 'totalSupply', chainId: cfg.chainId });

  // Spot: currency1 per currency0 → express as paired-per-SCOOP.
  let spot: number | null = null;
  if (slot0.data && s) { const p = spotFromSqrtPrice(slot0.data[0]); spot = s.tokenIsCurrency0 ? p : 1 / p; }

  useEffect(() => {
    setQuote(null); setQuoteError(null); setSimError(null);
    if (!publicClient || !poolKey || !net || amountIn === null) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await publicClient.simulateContract({ address: net.uniswapV4.quoter, abi: QUOTER_ABI, functionName: 'quoteExactInputSingle', args: [{ poolKey, zeroForOne, exactAmount: amountIn, hookData: '0x' }] });
        if (!cancelled) setQuote({ out: r.result[0], forIn: amountIn });
      } catch (e) { if (!cancelled) setQuoteError(errorText(e)); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [publicClient, poolKey, net, amountIn, zeroForOne]);

  const minOut = quote ? applySlippage(quote.out, slippageBps) : null;
  const canTransact = w.onChain && !!w.walletClient && tradingEnabled;
  const enough = balIn.data !== undefined && amountIn !== null && balIn.data >= amountIn;

  const swap = async () => {
    if (!canTransact || !w.walletClient || !w.address || !publicClient || !poolKey || !net || amountIn === null || minOut === null) return;
    setSimError(null);
    const { commands, inputs } = encodeSwapInputs({ poolKey, zeroForOne, amountIn, amountOutMinimum: minOut, extended: net.uniswapV4.extendedSwapParams === true });
    const permit2 = net.uniswapV4.permit2, router = net.uniswapV4.universalRouter;
    const expiration = permit2Expiration(now);
    const ok = await tx.run([
      {
        label: `Approve ${inSym} to Permit2`,
        skip: async () => (await publicClient.readContract({ address: inAddr, abi: ERC20_ABI, functionName: 'allowance', args: [w.address!, permit2] })) >= amountIn,
        write: () => w.walletClient!.writeContract({ address: inAddr, abi: ERC20_ABI, functionName: 'approve', args: [permit2, amountIn], chain: w.walletClient!.chain, account: w.address! }),
      },
      {
        label: `Permit2: allow the Universal Router to spend ${inSym}`,
        skip: async () => { const [amt, exp] = await publicClient.readContract({ address: permit2, abi: PERMIT2_ABI, functionName: 'allowance', args: [w.address!, inAddr, router] }); return amt >= amountIn && Number(exp) > now + 60; },
        write: () => w.walletClient!.writeContract({ address: permit2, abi: PERMIT2_ABI, functionName: 'approve', args: [inAddr, router, amountIn > maxUint160 ? maxUint160 : amountIn, expiration], chain: w.walletClient!.chain, account: w.address! }),
      },
      {
        label: `Swap ${fmtAmount(amountIn)} ${inSym} for at least ${fmtAmount(minOut)} ${outSym}`,
        write: async () => {
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
          try {
            const { request } = await publicClient.simulateContract({ address: router, abi: UNIVERSAL_ROUTER_ABI, functionName: 'execute', args: [commands, inputs, deadline], account: w.address!, value: 0n });
            return await w.walletClient!.writeContract(request);
          } catch (e) { setSimError(errorText(e)); throw e; }
        },
      },
    ]);
    if (ok) { setAmountText(''); void balIn.refetch(); void balOut.refetch(); }
  };

  return (
    <>
      <section className="section" aria-labelledby="trade-h">
        <p className="section__kicker">Launch pool</p>
        <h2 id="trade-h">Buy &amp; sell SCOOP</h2>
        <div className="columns columns--main">
          <div>
            <p className="prose">SCOOP trades against {pair?.symbol ?? 'its paired currency'} in a Uniswap v4 pool with a {poolKey ? (poolKey.fee / 10_000).toFixed(2) : '?'}% fee. Quotes are simulated through the chain's quoter; the swap is checked for reverts before your wallet is asked to sign.</p>
            <dl className="kv">
              <dt>Spot</dt><dd className="num">{spot === null ? (slot0.isLoading ? 'reading…' : 'unavailable') : `${spot.toPrecision(4)} ${pair?.symbol ?? ''} per SCOOP · ${(1 / spot).toPrecision(4)} SCOOP per ${pair?.symbol ?? ''}`}</dd>
              <dt>Liquidity</dt><dd className="num">{liquidity.data === undefined ? '—' : liquidity.data.toString()}</dd>
              <dt>Supply</dt><dd className="num">{fmtAmount(supply.data, 18, 0)} SCOOP</dd>
              <dt>USD</dt><dd>No USD source on this site; amounts are in {pair?.symbol ?? 'the pair token'} and SCOOP.</dd>
            </dl>
            <div className="stack" style={{ marginTop: '1rem' }}>
              <CopyAddress label="SCOOP token" address={token} />
              {pair && <CopyAddress label={pair.symbol} address={pair.address} />}
            </div>
          </div>
          <div className="card">
            {!tradingEnabled && <p className="notice notice--error" role="alert">Trading is disabled: the deployment configuration has no vetted network block or pool key for this chain.</p>}
            {tradingEnabled && !w.isConnected && <p>Connect a wallet to swap. Quotes work without one.</p>}
            {tradingEnabled && w.isConnected && !w.onChain && <p>Switch to {net!.name} to swap.</p>}
            <div className="row" role="group" aria-label="Direction">
              <button type="button" className={`btn ${side === 'buy' ? 'btn--primary' : ''}`} aria-pressed={side === 'buy'} onClick={() => setSide('buy')}>Buy SCOOP</button>
              <button type="button" className={`btn ${side === 'sell' ? 'btn--primary' : ''}`} aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>Sell SCOOP</button>
            </div>
            <div className="field" style={{ marginTop: '1rem' }}>
              <label htmlFor="amount">You pay ({inSym})</label>
              <input id="amount" type="text" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} aria-describedby="amount-hint" autoComplete="off" />
              <span id="amount-hint" className="hint num">{w.address ? `Balance ${fmtAmount(balIn.data)} ${inSym}` : `Amount in ${inSym}, 18 decimals.`}</span>
            </div>
            <div className="field">
              <label htmlFor="slippage">Max slippage (%)</label>
              <input id="slippage" type="number" min="0" max="50" step="0.1" value={slippage} onChange={(e) => setSlippage(e.target.value)} />
            </div>
            <dl className="kv" aria-live="polite">
              <dt>You receive</dt><dd className="num">{quote ? `≈ ${fmtAmount(quote.out)} ${outSym}` : amountIn ? (quoteError ? 'no quote' : 'quoting…') : '—'}</dd>
              <dt>Minimum</dt><dd className="num">{minOut !== null ? `${fmtAmount(minOut)} ${outSym}` : '—'}</dd>
              {w.address && <><dt>Your {outSym}</dt><dd className="num">{fmtAmount(balOut.data)}</dd></>}
            </dl>
            {quoteError && <p className="notice notice--error">Quote failed: {quoteError}</p>}
            <p className="hint" style={{ fontFamily: 'var(--font-sans)' }}>Steps: approve {inSym} to Permit2, allow the router through Permit2, then swap. Steps already satisfied are skipped.</p>
            <button type="button" className="btn btn--accent" disabled={!canTransact || tx.running || !quote || minOut === null || !enough} onClick={() => void swap()}>
              {tx.running ? 'Working…' : `Swap ${inSym} for ${outSym}`}
            </button>
            {w.onChain && amountIn !== null && balIn.data !== undefined && !enough && <p className="error" style={{ fontFamily: 'var(--font-sans)', color: 'var(--red)' }}>Not enough {inSym}.</p>}
            {simError && <p className="notice notice--error" role="alert">The swap would revert: {simError}</p>}
            <Steps steps={tx.steps} error={tx.error && !simError ? tx.error : null} />
          </div>
        </div>
      </section>
    </>
  );
}
