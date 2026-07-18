'use client';

import * as React from 'react';
import {
  Coins,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  PartyPopper,
  RefreshCw,
  Terminal,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { useToast } from '@/components/ui/toast';
import { useWizard } from '../wizard-context';
import { AddressRow, StepHeading, StepMotion, StepNav } from '../step-parts';
import { faucetGatewayConfigured, requestFaucet } from '@/lib/thru/faucet';
import { formatBalance, getAccountSnapshot, waitForFunds } from '@/lib/thru/account';
import { privateKeyText } from '@/lib/thru/keys';
import { accountUrl } from '@/lib/thru/explorer';
import { thruConfig } from '@/lib/thru/config';
import { popSuccess } from '@/lib/confetti';

type Phase = 'idle' | 'requesting' | 'waiting' | 'funded' | 'error';

export function FundStep() {
  const { account, funded, dispatch } = useWizard();
  const { toast } = useToast();
  const [phase, setPhase] = React.useState<Phase>(funded ? 'funded' : 'idle');
  const [balance, setBalance] = React.useState<bigint>(0n);
  const [message, setMessage] = React.useState<string>('');
  const [checking, setChecking] = React.useState(false);
  const [revealKey, setRevealKey] = React.useState(false);
  const [gateway, setGateway] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const isFunded = phase === 'funded' || funded;

  // Check for an optional HTTP faucet gateway, and poll balance while unfunded.
  React.useEffect(() => {
    if (!account) return;
    void faucetGatewayConfigured().then(setGateway);
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
      if (snap.balance > 0n && !isFunded) {
        markFunded();
      }
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

  // Optional one-click path (only when a gateway is configured for this deploy).
  async function handleGatewayFaucet() {
    if (!account) return;
    setPhase('requesting');
    setMessage('');
    try {
      const res = await requestFaucet(account.address);
      if (!res.ok) {
        setPhase('error');
        setMessage(res.message);
        toast({ variant: 'error', title: 'Faucet request failed', description: res.message });
        return;
      }
      toast({ variant: 'success', title: 'Faucet request sent', description: res.message });
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
        setMessage('Tokens have not arrived yet. The faucet may be busy — try again or use the CLI below.');
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setPhase('error');
      setMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  const pk = account ? privateKeyText(account) : '';
  const maskedPk = revealKey ? pk : `${pk.slice(0, 6)}${'•'.repeat(12)}${pk.slice(-4)}`;

  const steps: { label: string; display: string; copy: string }[] = account
    ? [
        {
          label: 'Install the Thru CLI',
          display: 'npm i -g thru',
          copy: 'npm i -g thru',
        },
        {
          label: 'Import your key (stays on your machine)',
          display: `thru keys add default ${maskedPk}`,
          copy: `thru keys add default ${pk}`,
        },
        {
          label: `Claim ${thruConfig.faucetAmountLabel} from the faucet`,
          display: `thru faucet withdraw default ${thruConfig.faucetAmount} --url ${thruConfig.rpcUrl}`,
          copy: `thru faucet withdraw default ${thruConfig.faucetAmount} --url ${thruConfig.rpcUrl}`,
        },
      ]
    : [];

  return (
    <StepMotion>
      <div className="mx-auto max-w-2xl space-y-6">
        <StepHeading
          eyebrow="Step 2"
          title="Fund your account"
          description={`Thru's faucet is an on-chain program. The quickest way to claim ${thruConfig.network} test tokens is the Thru CLI — three commands, pre-filled with your key below. Your balance updates here automatically.`}
        />

        {/* Balance */}
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

            {isFunded && (
              <div className="flex items-center justify-center gap-2 rounded-sm border border-success bg-success/5 py-4 text-success">
                <PartyPopper className="size-5" />
                <span className="font-semibold">You&apos;re funded and ready to build!</span>
              </div>
            )}

            {/* Optional one-click gateway button */}
            {!isFunded && gateway && (
              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                onClick={handleGatewayFaucet}
                loading={phase === 'requesting' || phase === 'waiting'}
                disabled={phase === 'requesting' || phase === 'waiting'}
              >
                {phase === 'waiting' ? (
                  <>
                    <Loader2 className="animate-spin" /> Waiting for tokens…
                  </>
                ) : (
                  <>
                    <Coins /> Get {thruConfig.faucetAmountLabel} (instant)
                  </>
                )}
              </Button>
            )}

            {phase === 'error' && message && <p className="text-center text-sm text-destructive">{message}</p>}
          </CardContent>
        </Card>

        {/* CLI claim steps */}
        {!isFunded && account && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Terminal className="size-4 text-primary" />
                  Claim with the Thru CLI
                </div>
                <Button variant="ghost" size="sm" onClick={() => setRevealKey((v) => !v)}>
                  {revealKey ? <EyeOff /> : <Eye />}
                  {revealKey ? 'Hide key' : 'Reveal key'}
                </Button>
              </div>

              <ol className="space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="space-y-1.5">
                    <p className="label-mono text-muted-foreground">
                      {i + 1}. {s.label}
                    </p>
                    <div className="flex items-stretch gap-2">
                      <code className="flex min-w-0 flex-1 items-center overflow-x-auto rounded-sm border border-foreground bg-foreground px-3 py-2 font-mono text-xs text-background">
                        <span className="mr-2 shrink-0 select-none text-primary">$</span>
                        <span className="whitespace-pre">{s.display}</span>
                      </code>
                      <CopyButton value={s.copy} variant="outline" className="h-auto shrink-0" />
                    </div>
                  </li>
                ))}
              </ol>

              <div className="flex flex-col gap-3 border-t border-border-muted pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Commands run locally — your key never leaves your machine. Balance refreshes
                  automatically once the claim lands.
                </p>
                <Button variant="secondary" size="sm" onClick={() => refreshBalance()} loading={checking} className="shrink-0">
                  <RefreshCw className="size-4" /> Check balance
                </Button>
              </div>

              <a
                href={thruConfig.devkitDocsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                New to the CLI? Read the DevKit setup guide <ExternalLink className="size-3.5" />
              </a>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Faucet withdrawals are capped per transaction to keep {thruConfig.network} healthy. Test
          tokens have no monetary value.
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
