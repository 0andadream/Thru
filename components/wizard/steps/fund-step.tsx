'use client';

import * as React from 'react';
import { Coins, ExternalLink, Loader2, PartyPopper, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { useWizard } from '../wizard-context';
import { AddressRow, StepHeading, StepMotion, StepNav } from '../step-parts';
import { requestFaucet } from '@/lib/thru/faucet';
import { formatBalance, getAccountSnapshot, waitForFunds } from '@/lib/thru/account';
import { accountUrl } from '@/lib/thru/explorer';
import { thruConfig } from '@/lib/thru/config';
import { popSuccess } from '@/lib/confetti';

type Phase = 'idle' | 'requesting' | 'waiting' | 'funded' | 'error' | 'manual';

export function FundStep() {
  const { account, funded, dispatch } = useWizard();
  const { toast } = useToast();
  const [phase, setPhase] = React.useState<Phase>(funded ? 'funded' : 'idle');
  const [balance, setBalance] = React.useState<bigint>(0n);
  const [message, setMessage] = React.useState<string>('');
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    // On entry, check if the account is already funded.
    if (!account) return;
    void refreshBalance();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshBalance() {
    if (!account) return;
    try {
      const snap = await getAccountSnapshot(account.address);
      setBalance(snap.balance);
      if (snap.balance > 0n) {
        setPhase('funded');
        dispatch({ type: 'setFunded', value: true });
      }
    } catch {
      /* RPC hiccup — leave state as-is */
    }
  }

  async function handleFaucet() {
    if (!account) return;
    setPhase('requesting');
    setMessage('');
    try {
      const res = await requestFaucet(account.address);
      if (res.manual) {
        setPhase('manual');
        setMessage(res.message);
        return;
      }
      if (!res.ok) {
        setPhase('error');
        setMessage(res.message);
        toast({ variant: 'error', title: 'Faucet request failed', description: res.message });
        return;
      }

      toast({ variant: 'success', title: 'Faucet request sent', description: res.message });
      setPhase('waiting');

      // Poll for the balance to land.
      abortRef.current = new AbortController();
      const snap = await waitForFunds(account.address, {
        timeoutMs: 90_000,
        intervalMs: 3_000,
        signal: abortRef.current.signal,
        onTick: (s) => setBalance(s.balance),
      });

      if (snap.balance > 0n) {
        setBalance(snap.balance);
        setPhase('funded');
        dispatch({ type: 'setFunded', value: true });
        popSuccess(0.5, 0.45);
        toast({ variant: 'success', title: 'Tokens received!', description: 'Your account is funded.' });
      } else {
        setPhase('error');
        setMessage(
          'The tokens have not arrived yet. The faucet may be busy — you can retry, or check your balance again in a moment.',
        );
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setPhase('error');
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessage(msg);
      toast({ variant: 'error', title: 'Something went wrong', description: msg });
    }
  }

  const isFunded = phase === 'funded' || funded;

  return (
    <StepMotion>
      <div className="mx-auto max-w-2xl space-y-6">
        <StepHeading
          eyebrow="Step 2"
          title="Get free test tokens"
          description={`You need a little ${thruConfig.network} test currency to pay for transactions. Tap the faucet below — it's free and takes a few seconds.`}
        />

        <Card className={isFunded ? 'border-success/40' : undefined}>
          <CardContent className="space-y-5 p-6">
            {account && <AddressRow label="Funding this account" value={account.address} href={accountUrl(account.address)} />}

            <div className="flex items-center justify-between rounded-sm bg-secondary/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Current balance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {formatBalance(balance)}
                </span>
                <Badge variant={isFunded ? 'success' : 'secondary'}>tTHRU</Badge>
                <Button variant="ghost" size="icon" onClick={refreshBalance} aria-label="Refresh balance">
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            </div>

            {isFunded ? (
              <div className="flex items-center justify-center gap-2 rounded-sm border border-success/30 bg-success/5 py-4 text-success">
                <PartyPopper className="size-5" />
                <span className="font-semibold">You&apos;re funded and ready to build!</span>
              </div>
            ) : (
              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                onClick={handleFaucet}
                loading={phase === 'requesting' || phase === 'waiting'}
                disabled={phase === 'requesting' || phase === 'waiting'}
              >
                {phase === 'waiting' ? (
                  <>
                    <Loader2 className="animate-spin" /> Waiting for tokens to arrive…
                  </>
                ) : (
                  <>
                    <Coins /> Get {thruConfig.faucetAmountLabel}
                  </>
                )}
              </Button>
            )}

            {phase === 'manual' && (
              <div className="space-y-3 rounded-sm border border-warning/30 bg-warning/10 p-4 text-sm">
                <p className="font-semibold text-warning">Manual funding</p>
                <p className="text-muted-foreground">{message}</p>
                <p className="text-muted-foreground">
                  Copy your address above and paste it into the official faucet, then come back and
                  press refresh.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://faucet.alphanet.thru.org" target="_blank" rel="noreferrer">
                    Open official faucet <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            )}

            {phase === 'error' && message && (
              <p className="text-center text-sm text-destructive">{message}</p>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Faucet drips are rate limited to keep the network healthy. Test tokens have no value.
            </p>
          </CardContent>
        </Card>

        <StepNav
          onBack={() => dispatch({ type: 'back' })}
          onNext={() => dispatch({ type: 'next' })}
          nextDisabled={!isFunded}
          nextLabel={isFunded ? 'Continue to deploy' : 'Get tokens to continue'}
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
