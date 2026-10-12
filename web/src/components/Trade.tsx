import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePool } from '../market';
import { WalletBar } from './WalletBar';
import { RetryNotice } from './Feedback';
import { usePublicClient, useReadContract } from 'wagmi';
import { maxUint160, zeroAddress } from 'viem';
import { useAppConfig, useNow, useTxRunner, useWallet } from '../hooks';
import { applySlippage, fmtAmount, fmtNumber, parseAmount, parseSlippage } from '../lib/format';
import { ERC20_ABI, PERMIT2_ABI, QUOTER_ABI, UNIVERSAL_ROUTER_ABI, encodeSwapInputs, permit2Expiration, sides } from '../lib/swap';
import { Steps } from './Steps';

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
  const pool = usePool();
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
  const slippageBps = parseSlippage(slippage);

  const balIn = useReadContract({ address: inAddr, abi: ERC20_ABI, functionName: 'balanceOf', args: [w.address ?? zeroAddress], chainId: cfg.chainId, query: { enabled: !!w.address && inAddr !== zeroAddress, refetchInterval: 30_000 } });
  const balOut = useReadContract({ address: outAddr, abi: ERC20_ABI, functionName: 'balanceOf', args: [w.address ?? zeroAddress], chainId: cfg.chainId, query: { enabled: !!w.address && outAddr !== zeroAddress, refetchInterval: 30_000 } });
  const supply = useReadContract({ address: token, abi: ERC20_ABI, functionName: 'totalSupply', chainId: cfg.chainId });

  const quoteQuery = useQuery({
    queryKey: ['swap-quote', cfg.chainId, poolKey, zeroForOne, amountIn?.toString()],
    enabled: !!publicClient && !!poolKey && !!net && amountIn !== null,
    queryFn: async () => {
      if (!publicClient || !poolKey || !net || amountIn === null) throw new Error('Quote unavailable');
      const r = await publicClient.simulateContract({ address: net.uniswapV4.quoter, abi: QUOTER_ABI, functionName: 'quoteExactInputSingle', args: [{ poolKey, zeroForOne, exactAmount: amountIn, hookData: '0x' }] });
      return { out: r.result[0], forIn: amountIn, zeroForOne };
    },
    refetchInterval: 20_000, staleTime: 0, retry: false,
  });
  const quote = quoteQuery.isError ? undefined : quoteQuery.data;
  const quoteError = quoteQuery.error;

  const minOut = quote && slippageBps !== null ? applySlippage(quote.out, slippageBps) : null;
  const canTransact = w.canTransact && tradingEnabled;
  const enough = balIn.data !== undefined && amountIn !== null && balIn.data >= amountIn;

  const swap = async () => {
    if (!canTransact || !w.walletClient || !w.address || !publicClient || !poolKey || !net || amountIn === null || minOut === null || slippageBps === null || !enough || tx.running || minOut <= 0n) return;
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
        label: `Swap ${fmtAmount(amountIn)} ${inSym} for ${outSym}`,
        write: async () => {
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
          // Approvals can take minutes. Quote once more immediately before simulating the swap.
          const fresh = await quoteQuery.refetch({ throwOnError: true });
          if (!fresh.data || fresh.data.out <= 0n || fresh.data.forIn !== amountIn || fresh.data.zeroForOne !== zeroForOne) throw new Error('Quote unavailable');
          const freshMinimum = applySlippage(fresh.data.out, slippageBps);
          // Never weaken the minimum the reader accepted before signing approvals.
          const floor = freshMinimum > minOut ? freshMinimum : minOut;
          const { commands, inputs } = encodeSwapInputs({ poolKey, zeroForOne, amountIn, amountOutMinimum: floor, extended: net.uniswapV4.extendedSwapParams === true });
          const { request } = await publicClient.simulateContract({ address: router, abi: UNIVERSAL_ROUTER_ABI, functionName: 'execute', args: [commands, inputs, deadline], account: w.address!, value: 0n });
          return await w.walletClient!.writeContract(request);
        },
      },
    ]);
    if (ok) { setAmountText(''); void balIn.refetch(); void balOut.refetch(); }
  };

  return (
    <>
      <section className="section" aria-labelledby="trade-h">
        <h2 id="trade-h">Buy &amp; sell SCOOP</h2>
        <div className="columns columns--main trade-columns">
          <div className="card trade-card">
            {!tradingEnabled && <p className="notice notice--error" role="alert">Trading is disabled: the deployment configuration has no vetted network block or pool key for this chain.</p>}
            {tradingEnabled && w.isConnected && !w.onChain && <p>Switch to {net!.name} to swap.</p>}
            <div className="row" role="group" aria-label="Direction">
              <button type="button" className={`btn ${side === 'buy' ? 'btn--primary' : ''}`} disabled={tx.running} aria-pressed={side === 'buy'} onClick={() => setSide('buy')}>Buy SCOOP</button>
              <button type="button" className={`btn ${side === 'sell' ? 'btn--primary' : ''}`} disabled={tx.running} aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>Sell SCOOP</button>
            </div>
            <div className="field" style={{ marginTop: '1rem' }}>
              <label htmlFor="amount">You pay ({inSym})</label>
              <input disabled={tx.running} id="amount" type="text" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} aria-describedby="amount-hint" autoComplete="off" />
              <span id="amount-hint" className="hint num">{w.address ? `Balance ${fmtAmount(balIn.data)} ${inSym}` : `Amount in ${inSym}, 18 decimals.`}</span>
            </div>
            <div className="field">
              <label htmlFor="slippage">Max slippage (%)</label>
              <input disabled={tx.running} id="slippage" type="number" min="0" max="50" step="0.1" value={slippage} onChange={(e) => setSlippage(e.target.value)} aria-invalid={slippageBps === null} aria-describedby={slippageBps === null ? 'slippage-error' : undefined} />
              {slippageBps === null && <span id="slippage-error" className="error" role="alert">Enter slippage between 0 and 50%.</span>}
            </div>
            <dl className="kv" aria-live="polite">
              <dt>You receive</dt><dd className="num">{quote ? `≈ ${fmtAmount(quote.out)} ${outSym}` : amountIn ? (quoteError ? 'no quote' : 'quoting…') : '—'}</dd>
              <dt>Minimum</dt><dd className="num">{minOut !== null ? `${fmtAmount(minOut)} ${outSym}` : '—'}</dd>
              {w.address && <><dt>Your {outSym}</dt><dd className="num">{fmtAmount(balOut.data)}</dd></>}
            </dl>
            {quoteError && <RetryNotice retry={quoteQuery.refetch} />}
            <button type="button" className="btn btn--accent" disabled={!canTransact || tx.running || !quote || minOut === null || minOut <= 0n || !enough} onClick={() => void swap()}>
              {tx.running ? 'Working…' : `Swap ${inSym} for ${outSym}`}
            </button>
            <WalletBar />
            {(balIn.error || balOut.error) && <RetryNotice retry={() => Promise.all([balIn.refetch(), balOut.refetch()])} />}
            {tradingEnabled && !w.isConnected && <p>Connect a wallet to swap. Quotes work without one.</p>}
            <p className="hint" style={{ fontFamily: 'var(--font-sans)' }}>Steps: approve {inSym} to Permit2, allow the router through Permit2, then swap. Steps already satisfied are skipped.</p>
            {w.onChain && amountIn !== null && balIn.data !== undefined && !enough && <p className="error" style={{ fontFamily: 'var(--font-sans)', color: 'var(--red)' }}>Not enough {inSym}.</p>}
            <Steps steps={tx.steps} error={tx.error} retry={swap} />
          </div>
          <div className="trade-details">
            <p className="prose">Swap {pair?.symbol ?? 'the paired currency'} and SCOOP. Pool fee: {poolKey ? (poolKey.fee / 10_000).toFixed(2) : '?'}%.</p>
            <h3>Inside the pool</h3>
            <dl className="kv">
              <dt>Pool price</dt><dd className="num">{pool.spot === null ? (pool.loading ? 'Reading…' : 'Unavailable') : `${fmtNumber(1 / pool.spot)} SCOOP per ${pair?.symbol ?? 'IMD'}`}</dd>
              <dt>Per SCOOP</dt><dd className="num">{pool.spot === null ? '—' : `${fmtNumber(pool.spot)} ${pair?.symbol ?? 'IMD'}`}</dd>
              <dt>Pool reserves</dt><dd className="num">{pool.reserves ? <>{fmtAmount(pool.reserves.scoop)} SCOOP<br />{fmtAmount(pool.reserves.imd)} {pair?.symbol ?? 'IMD'}</> : '—'}</dd>
              <dt>Supply</dt><dd className="num">{fmtAmount(supply.data, 18, 0)} SCOOP</dd>
            </dl>
            <p className="legend">Reserves are virtual balances of active liquidity at the current price. They exclude liquidity outside the current range.</p>
            <p className="legend">Quotes refresh every 20 seconds and again before the swap. The minimum protects your chosen slippage.</p>
            {pool.error && <RetryNotice retry={pool.retry} />}
            {supply.error && <RetryNotice retry={supply.refetch} />}
          </div>
        </div>
      </section>
    </>
  );
}
