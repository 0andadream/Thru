'use client';

import * as React from 'react';
import { Coins, Loader2, PartyPopper, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  const isFunded = phase === 'funded' || funded;

  // Poll balance while unfunded so the step advances the moment tokens land.
  React.useEffect(() => {
    if (!account) return;
    void refreshBalance();
    const timer = setInterval(() => {
      if (!isFunded) void refreshBalance(true);
    }, 6000);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshBalance(silent = false) {
    if (!account) return;
    if (!silent) setChecking(true);
    try {
      const snap = await getAccountSnapshot(account.address);
      setBalance(snap.balance);
      if (snap.balance > 0n && !isFunded) markFunded();
    } catch {
      /* RPC hiccup — leave state as-is */
    } finally {
      if (!silent) setChecking(false);
    }
  }

  function markFunded() {
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
      setPhase('error');
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessage(`${msg} — please try again in a moment.`);
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

            {phase === 'error' && message && <p className="text-center text-sm text-destructive">{message}</p>}
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
