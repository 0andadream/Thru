'use client';

import * as React from 'react';
import { Loader2, ShieldCheck, Sparkles, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useWizard } from '../wizard-context';
import { AddressRow, StepHeading, StepMotion, StepNav } from '../step-parts';
import { claimName, getRegistrarQuote, isValidLabel, suggestRoots } from '@/lib/thru/nameservice';
import type { RegistrarQuote } from '@/lib/thru/registrar-onchain';
import type { TxPhase } from '@/lib/thru/types';
import { accountUrl, txUrl } from '@/lib/thru/explorer';
import { popSuccess } from '@/lib/confetti';

export function NameStep() {
  const { account, name, dispatch } = useWizard();
  const { toast } = useToast();
  const [domain, setDomain] = React.useState('');
  const [phase, setPhase] = React.useState<TxPhase>('idle');
  const [quote, setQuote] = React.useState<RegistrarQuote | null>(null);
  const [registryError, setRegistryError] = React.useState<string | null>(null);
  const [quoteAttempt, setQuoteAttempt] = React.useState(0);

  const suggestions = React.useMemo(() => (account ? suggestRoots(account.address) : []), [account]);
  React.useEffect(() => {
    if (!domain && suggestions[0]) setDomain(suggestions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  React.useEffect(() => {
    if (!account) return;
    let active = true;
    setRegistryError(null);
    getRegistrarQuote(account)
      .then((result) => active && setQuote(result))
      .catch((err) => active && setRegistryError(err instanceof Error ? err.message : 'Could not load the domain registry.'));
    return () => { active = false; };
  }, [account, quoteAttempt]);

  const valid = isValidLabel(domain);
  const busy = !['idle', 'confirmed', 'error'].includes(phase);
  const suffix = quote?.config.rootName ?? 'thru';
  const required = quote?.config.pricePerYear ?? 0n;
  const hasPayment = quote ? quote.paymentBalance >= required : false;

  async function handleClaim() {
    if (!account || !valid || !quote || !hasPayment) return;
    setPhase('building');
    try {
      const result = await claimName(account, { domain, records: {}, onPhase: setPhase });
      dispatch({ type: 'setName', name: result });
      setPhase('confirmed');
      popSuccess(0.5, 0.45);
      toast({ variant: 'success', title: 'Domain purchased!', description: result.fullName });
    } catch (err) {
      setPhase('error');
      toast({ variant: 'error', title: 'Could not purchase domain', description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return (
    <StepMotion>
      <div className="mx-auto max-w-2xl space-y-6">
        <StepHeading
          eyebrow="Step 4"
          title="Purchase your .thru name"
          description="Your name is leased through Thru’s on-chain Registrar. It creates both the lease and its Name Service domain in one transaction."
        />

        {!name ? (
          <Card>
            <CardContent className="space-y-5 p-5">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain name</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="yourname" className="pl-9 font-mono lowercase" maxLength={64} />
                  </div>
                  <span className="shrink-0 font-mono text-sm text-muted-foreground">.{suffix}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Suggestions:</span>
                  {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setDomain(suggestion)} className="rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 font-mono text-xs transition-colors hover:border-primary/50 hover:text-primary">{suggestion}</button>)}
                </div>
                {domain && !valid && <p className="text-xs text-destructive">Use 1–64 lowercase letters, numbers, or hyphens (no leading/trailing hyphen).</p>}
                {valid && <p className="flex items-center gap-1.5 text-sm font-medium text-primary"><Sparkles className="size-3.5" /> You&apos;re purchasing <span className="font-mono">{domain}.{suffix}</span></p>}
              </div>

              <div className="space-y-3 rounded-sm border border-border bg-secondary/30 p-4 text-sm">
                {registryError ? <div className="space-y-2"><p className="text-destructive">The Alphanet RPC is temporarily unavailable. No name transaction was sent.</p><p className="break-all text-xs text-muted-foreground">{registryError}</p><Button variant="outline" size="sm" onClick={() => setQuoteAttempt((attempt) => attempt + 1)}>Retry registrar check</Button></div> : !quote ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking the Alphanet registrar…</p> : <>
                  <div className="flex items-center justify-between gap-4"><span className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-primary" /> One-year lease</span><span className="font-mono">{required.toString()} payment units</span></div>
                  <div className="flex items-center justify-between gap-4 text-muted-foreground"><span>Your payment balance</span><span className={hasPayment ? 'font-mono text-success' : 'font-mono text-destructive'}>{quote.paymentBalance.toString()}</span></div>
                  {!hasPayment && <p className="text-xs text-destructive">Fund the payment token account before purchasing. The faucet funds network fees only, not registrar payment tokens.</p>}
                  <AddressRow label="Registrar payment account" value={quote.payerTokenAccount} href={accountUrl(quote.payerTokenAccount)} />
                </>}
              </div>

              <Button variant="gradient" size="lg" className="w-full" onClick={handleClaim} loading={busy} disabled={busy || !valid || !quote || !hasPayment}>
                {busy ? <><Loader2 className="animate-spin" /> Purchasing domain…</> : <><Tag /> Purchase {valid ? `${domain}.${suffix}` : 'my .thru name'}</>}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-success/40"><CardContent className="space-y-4 p-6"><div className="text-center"><p className="text-sm text-muted-foreground">You now lease</p><p className="font-mono text-2xl font-bold text-brand">{name.fullName}</p><Badge variant="success" className="mt-2">Registered on-chain</Badge></div><div className="space-y-2"><AddressRow label="Registry root" value={name.rootAddress} href={accountUrl(name.rootAddress)} /><AddressRow label="Domain account" value={name.subdomainAddress} href={accountUrl(name.subdomainAddress)} />{name.signature && <AddressRow label="Transaction" value={name.signature} href={txUrl(name.signature)} />}</div><Button variant="outline" size="sm" onClick={() => { dispatch({ type: 'setName', name: null }); setPhase('idle'); }}>Purchase a different name</Button></CardContent></Card>
        )}

        <StepNav onBack={() => dispatch({ type: 'back' })} onNext={() => dispatch({ type: 'next' })} nextDisabled={busy} nextLabel={name ? 'Finish' : 'Skip & finish'} />
      </div>
    </StepMotion>
  );
}
