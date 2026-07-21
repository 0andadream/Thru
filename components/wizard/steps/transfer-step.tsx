'use client';

import * as React from 'react';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Loader2, Send, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { accountUrl } from '@/lib/thru/explorer';
import { transferToken } from '@/lib/thru/token-transfer';
import type { TxPhase } from '@/lib/thru/types';
import { AddressRow, StepHeading, StepMotion, StepNav } from '../step-parts';
import { useWizard } from '../wizard-context';

const PHASE_LABEL: Record<TxPhase, string> = {
  idle: '', building: 'Preparing token account…', signing: 'Signing locally…',
  submitting: 'Submitting transfer…', confirming: 'Confirming on Thru…',
  confirmed: 'Transfer confirmed', error: 'Transfer failed',
};

function parseAmount(value: string, decimals: number): bigint {
  const text = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('Enter a valid token amount.');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) throw new Error(`This token supports at most ${decimals} decimal places.`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals));
}

export function TransferStep() {
  const { account, deployment, dispatch } = useWizard();
  const { toast } = useToast();
  const [view, setView] = React.useState<'send' | 'receive'>('send');
  const [recipient, setRecipient] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [phase, setPhase] = React.useState<TxPhase>('idle');
  const [sentTo, setSentTo] = React.useState<string>();

  const decimals = Number(deployment?.details?.Decimals ?? 6);
  const ticker = deployment?.details?.Ticker ?? 'TOKEN';
  const canTransfer = Boolean(account && deployment?.onChain && deployment.bufferAddress && !deployment.warning);
  const busy = !['idle', 'confirmed', 'error'].includes(phase);

  async function handleSend() {
    if (!account || !deployment?.bufferAddress) return;
    setPhase('building');
    try {
      const result = await transferToken(account, {
        mintAddress: deployment.metaAddress,
        sourceTokenAccount: deployment.bufferAddress,
        recipientAddress: recipient,
        amount: parseAmount(amount, decimals),
      }, setPhase);
      setSentTo(result.recipientTokenAccount);
      setAmount('');
      setPhase('confirmed');
      toast({ variant: 'success', title: 'Token sent', description: `${ticker} is on its way to the recipient.` });
    } catch (err) {
      setPhase('error');
      toast({ variant: 'error', title: 'Transfer failed', description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return (
    <StepMotion>
      <div className="mx-auto max-w-2xl space-y-6">
        <StepHeading
          eyebrow="Step 4"
          title="Send and receive your token"
          description="Move the token you minted to any Thru address. A recipient token account is created automatically when needed."
        />

        {canTransfer && account && deployment ? (
          <Card className="glass-card overflow-hidden">
            <div className="flex gap-1 border-b border-white/30 bg-white/20 p-2">
              <Button variant={view === 'send' ? 'gradient' : 'ghost'} size="sm" className="flex-1" onClick={() => setView('send')}>
                <ArrowUpRight /> Send
              </Button>
              <Button variant={view === 'receive' ? 'gradient' : 'ghost'} size="sm" className="flex-1" onClick={() => setView('receive')}>
                <ArrowDownLeft /> Receive
              </Button>
            </div>
            <CardContent className="p-5 sm:p-7">
              {view === 'send' ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between rounded-2xl border border-white/40 bg-white/30 p-4">
                    <div>
                      <p className="label-mono text-muted-foreground">Sending</p>
                      <p className="mt-1 text-xl font-semibold">{deployment.label}</p>
                    </div>
                    <Badge variant="success">{ticker}</Badge>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipient">Recipient Thru address</Label>
                    <Input id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value.trim())} placeholder="ta…" className="font-mono" />
                    <p className="text-xs text-muted-foreground">Send to the wallet address, not a token-account address.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <div className="relative">
                      <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pr-20 text-lg font-semibold" />
                      <span className="absolute right-4 top-3 text-sm font-semibold text-muted-foreground">{ticker}</span>
                    </div>
                  </div>
                  <Button variant="gradient" size="lg" className="w-full" onClick={handleSend} loading={busy} disabled={busy || !recipient || !amount}>
                    {busy ? <><Loader2 className="animate-spin" /> {PHASE_LABEL[phase]}</> : <><Send /> Send {ticker}</>}
                  </Button>
                  {sentTo && (
                    <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
                      <p className="mb-2 flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="size-4" /> Transfer confirmed</p>
                      <AddressRow label="Recipient token account" value={sentTo} href={accountUrl(sentTo)} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5">
                    <WalletCards className="mb-3 size-7 text-primary" />
                    <p className="text-lg font-semibold">Receive {ticker}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Share your Thru address. Senders using this app can create your token account automatically.</p>
                  </div>
                  <AddressRow label="Your Thru address" value={account.address} href={accountUrl(account.address)} />
                  <AddressRow label={`${ticker} token account`} value={deployment.bufferAddress!} href={accountUrl(deployment.bufferAddress!)} />
                  <p className="text-xs text-muted-foreground">Only share these public addresses. Never share your private key.</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card">
            <CardContent className="p-6 text-center">
              <WalletCards className="mx-auto mb-3 size-8 text-primary" />
              <p className="font-semibold">Launch a complete token first</p>
              <p className="mt-1 text-sm text-muted-foreground">Sending is available after your mint, token account, and initial supply are confirmed on-chain.</p>
              <Button variant="outline" className="mt-5" onClick={() => dispatch({ type: 'goto', index: 3 })}>Go to token launch</Button>
            </CardContent>
          </Card>
        )}
        <StepNav onBack={() => dispatch({ type: 'back' })} onNext={() => dispatch({ type: 'next' })} nextLabel="Continue to naming" nextDisabled={busy} />
      </div>
    </StepMotion>
  );
}
