'use client';

import * as React from 'react';
import { Coins, ExternalLink, Loader2, PartyPopper, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { useToast } from '@/components/ui/toast';
import { useWizard } from '../wizard-context';
import { AddressRow, StepHeading, StepMotion, StepNav } from '../step-parts';
import { formatBalance, getAccountSnapshot, waitForFunds } from '@/lib/thru/account';
import { claimFaucetInBrowser } from '@/lib/thru/faucet-onchain';
import { accountUrl } from '@/lib/thru/explorer';
import { thruConfig } from '@/lib/thru/config';
import { popSuccess } from '@/lib/confetti';
import type { TxPhase } from '@/lib/thru/types';

type Phase = 'idle' | 'requesting' | 'waiting' | 'funded' | 'error';

const TX_LABEL: Record<TxPhase, string> = {
  idle: 'Claiming…',
  building: 'Preparing your account…',
  signing: 'Signing locally…',
  submitting: 'Submitting to the network…',
  confirming: 'Confirming on-chain…',
  confirmed: 'Confirmed!',
  error: 'Something went wrong',
};

export function FundStep() {
  const { account, funded, dispatch } = useWizard();
  const { toast } = useToast();
  const [phase, setPhase] = React.useState<Phase>(funded ? 'funded' : 'idle');
  const [balance, setBalance] = React.useState<bigint>(0n);
  const [message, setMessage] = React.useState<string>('');
  const [checking, setChecking] = React.useState(false);
  const [txPhase, setTxPhase] = React.useState<TxPhase>('idle');
  const abortRef = React.useRef<AbortController | null>(null);

  // "Funded" always reflects the real on-chain balance (never a stale flag).
  const isFunded = funded;
  const fundedRef = React.useRef(funded);
  React.useEffect(() => {
    fundedRef.current = funded;
  }, [funded]);

  // Verify the real balance on entry, then poll while unfunded so the step
  // advances the moment tokens land.
  React.useEffect(() => {
    if (!account) return;
    void refreshBalance(true);
    const timer = setInterval(() => {
      if (!fundedRef.current) void refreshBalance(true, true);
    }, 6000);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  async function refreshBalance(silent = false, celebrate = false) {
    if (!account) return;
    if (!silent) setChecking(true);
    try {
      const snap = await getAccountSnapshot(account.address);
      setBalance(snap.balance);
      const nowFunded = snap.balance > 0n;
      if (nowFunded !== fundedRef.current) {
        fundedRef.current = nowFunded;
        dispatch({ type: 'setFunded', value: nowFunded });
        if (nowFunded) {
          setPhase('funded');
          if (celebrate) {
            popSuccess(0.5, 0.45);
            toast({ variant: 'success', title: 'Tokens received!', description: 'Your account is funded.' });
          }
        } else if (phase === 'funded') {
          setPhase('idle');
        }
      }
    } catch {
      /* RPC hiccup — leave state as-is */
    } finally {
      if (!silent) setChecking(false);
    }
  }

  function markFunded() {
    fundedRef.current = true;
    setPhase('funded');
    dispatch({ type: 'setFunded', value: true });
    popSuccess(0.5, 0.45);
    toast({ variant: 'success', title: 'Tokens received!', description: 'Your account is funded.' });
  }

  async function handleFaucet() {
    if (!account) return;
    setPhase('requesting');
    setTxPhase('building');
    setMessage('');
    try {
      // If the account already has any balance, it's funded — don't re-claim
      // (the faucet rejects repeat claims per account).
      const pre = await getAccountSnapshot(account.address);
      if (pre.balance > 0n) {
        setBalance(pre.balance);
        markFunded();
        return;
      }

      // Fully client-side claim: create the account if needed, then withdraw
      // from the on-chain faucet to it. No server / operator / CLI required.
      await claimFaucetInBrowser(account, BigInt(thruConfig.faucetAmount), setTxPhase);

      setPhase('waiting');
      abortRef.current = new AbortController();
      const snap = await waitForFunds(account.address, {
        timeoutMs: 90_000,
        intervalMs: 3000,
        signal: abortRef.current.signal,
        onTick: (s) => setBalance(s.balance),
      });
      if (snap.balance > 0n) markFunded();
      else {
        setPhase('error');
        setMessage('The claim went through but the balance has not updated yet — give it a moment and press refresh.');
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      // If the account ended up with a balance anyway, treat it as funded.
      try {
        const after = await getAccountSnapshot(account.address);
        if (after.balance > 0n) {
          setBalance(after.balance);
          markFunded();
          return;
        }
      } catch {
        /* ignore */
      }
      setPhase('error');
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessage(msg);
      toast({ variant: 'error', title: 'Faucet claim failed', description: msg });
    }
  }

  const busy = phase === 'requesting' || phase === 'waiting';

  return (
    <StepMotion>
      <div className="mx-auto max-w-2xl space-y-6">
        <StepHeading
          eyebrow="Step 2"
          title="Fund your account"
          description={`Get free ${thruConfig.network} test tokens to pay for transactions. One tap claims them from the on-chain faucet, right in your browser — no wallet, no server, no command line.`}
        />

        <Card className={isFunded ? 'border-success' : undefined}>
          <CardContent className="space-y-5 p-6">
            {account && (
              <AddressRow label="Funding this account" value={account.address} href={accountUrl(account.address)} />
            )}

            <div className="flex items-center justify-between rounded-sm border border-border-muted bg-secondary/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-muted-foreground" />
                <span className="label-mono text-muted-foreground">Current balance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-semibold tabular-nums">{formatBalance(balance)}</span>
                <Badge variant={isFunded ? 'success' : 'secondary'}>tTHRU</Badge>
                <Button variant="ghost" size="icon" onClick={() => refreshBalance()} aria-label="Refresh balance" disabled={checking}>
                  <RefreshCw className={checking ? 'size-4 animate-spin' : 'size-4'} />
                </Button>
              </div>
            </div>

            {isFunded ? (
              <div className="flex items-center justify-center gap-2 rounded-sm border border-success bg-success/5 py-4 text-success">
                <PartyPopper className="size-5" />
                <span className="font-semibold">You&apos;re funded and ready to build!</span>
              </div>
            ) : (
              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                onClick={handleFaucet}
                loading={busy}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="animate-spin" />{' '}
                    {phase === 'waiting' ? 'Waiting for tokens…' : TX_LABEL[txPhase]}
                  </>
                ) : (
                  <>
                    <Coins /> Get {thruConfig.faucetAmountLabel}
                  </>
                )}
              </Button>
            )}

            {!isFunded && (
              <div className="flex flex-col items-center gap-2 rounded-sm border border-border-muted bg-secondary/30 p-3 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
                <span>Having trouble with the in-app claim? Use the community faucet.</span>
                <Button variant="outline" size="sm" asChild>
                  <a href={thruConfig.communityFaucetUrl} target="_blank" rel="noreferrer noopener">
                    Open faucet.thruscan.net <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            )}

            {phase === 'error' && message && (
              <div className="space-y-3 rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm">
                <p className="text-destructive">{message}</p>
                <p className="text-xs text-muted-foreground">
                  The {thruConfig.network} faucet can be flaky during busy periods or after a network
                  reset. Try again, or use the community faucet with your address:
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" size="sm" onClick={handleFaucet} disabled={busy}>
                    <RefreshCw className="size-4" /> Try again
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={thruConfig.communityFaucetUrl} target="_blank" rel="noreferrer noopener">
                      Open community faucet <ExternalLink className="size-4" />
                    </a>
                  </Button>
                  {account && <CopyButton value={account.address} label="Copy my address" variant="ghost" size="sm" showValue />}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Faucet claims are rate limited to keep {thruConfig.network} healthy. Test tokens have no
          monetary value.
        </p>

        <StepNav
          onBack={() => dispatch({ type: 'back' })}
          onNext={() => dispatch({ type: 'next' })}
          nextDisabled={!isFunded}
          nextLabel={isFunded ? 'Continue to deploy' : 'Claim tokens to continue'}
          secondary={
            !isFunded ? (
              <Button variant="ghost" onClick={() => dispatch({ type: 'next' })} className="text-muted-foreground">
                Skip for now
              </Button>
            ) : undefined
          }
        />
      </div>
    </StepMotion>
  );
}
