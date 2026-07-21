'use client';

import * as React from 'react';
import { AtSign, Globe, Link2, Loader2, Sparkles, Tag, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useWizard } from '../wizard-context';
import { AddressRow, StepHeading, StepMotion, StepNav } from '../step-parts';
import { claimName, deriveNameAddresses, isValidLabel, suggestRoots } from '@/lib/thru/nameservice';
import type { NameRecord, TxPhase } from '@/lib/thru/types';
import { accountUrl, txUrl } from '@/lib/thru/explorer';
import { popSuccess } from '@/lib/confetti';

export function NameStep() {
  const { account, name, advanced, dispatch } = useWizard();
  const { toast } = useToast();
  const [root, setRoot] = React.useState('');
  const [subdomain, setSubdomain] = React.useState('');
  const [records, setRecords] = React.useState<NameRecord>({});
  const [phase, setPhase] = React.useState<TxPhase>('idle');

  const suggestions = React.useMemo(
    () => (account ? suggestRoots(account.address) : []),
    [account],
  );

  React.useEffect(() => {
    if (!root && suggestions[0]) setRoot(suggestions[0]);
    if (!subdomain && account) setSubdomain('me');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  const rootValid = isValidLabel(root);
  const subValid = isValidLabel(subdomain);
  const busy = phase !== 'idle' && phase !== 'confirmed' && phase !== 'error';

  const preview = rootValid && subValid ? deriveNameAddresses(root, subdomain) : null;

  async function handleClaim() {
    if (!account || !rootValid || !subValid) return;
    setPhase('building');
    try {
      const result = await claimName(account, {
        root,
        subdomain,
        records,
        onPhase: setPhase,
      });
      dispatch({ type: 'setName', name: result });
      setPhase('confirmed');
      popSuccess(0.5, 0.45);
      toast({
        variant: 'success',
        title: result.onChain ? 'Name registered!' : 'Name reserved (preview)',
        description: result.fullName,
      });
    } catch (err) {
      setPhase('error');
      toast({
        variant: 'error',
        title: 'Could not claim name',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return (
    <StepMotion>
      <div className="mx-auto max-w-2xl space-y-6">
        <StepHeading
          eyebrow="Step 4"
          title="Claim your name"
          description="Register a human-readable root name and a subdomain — like alice.yourname — so people can find you without long addresses."
        />

        {!name ? (
          <Card>
            <CardContent className="space-y-5 p-5">
              {/* Root name */}
              <div className="space-y-2">
                <Label htmlFor="root">Root name</Label>
                <div className="relative">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="root"
                    value={root}
                    onChange={(e) => setRoot(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="yourname"
                    className="pl-9 font-mono lowercase"
                    maxLength={32}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Suggestions:</span>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRoot(s)}
                      className="rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 font-mono text-xs transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRoot(suggestions[Math.floor(Math.random() * suggestions.length)] ?? '')}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-primary hover:underline"
                  >
                    <Wand2 className="size-3" /> Shuffle
                  </button>
                </div>
                {root && !rootValid && (
                  <p className="text-xs text-destructive">
                    Use 1–32 lowercase letters, numbers, or hyphens (no leading/trailing hyphen).
                  </p>
                )}
              </div>

              {/* Subdomain */}
              <div className="space-y-2">
                <Label htmlFor="sub">Subdomain</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="sub"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="me"
                      className="pl-9 font-mono lowercase"
                      maxLength={32}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-sm text-muted-foreground">
                    .{root || 'yourname'}
                  </span>
                </div>
                {subdomain && !subValid && (
                  <p className="text-xs text-destructive">Subdomain must be 1–32 valid characters.</p>
                )}
                {rootValid && subValid && (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    <Sparkles className="size-3.5" />
                    You&apos;re claiming <span className="font-mono">{subdomain}.{root}</span>
                  </p>
                )}
              </div>

              {/* Optional records */}
              <details className="group rounded-sm border border-border" open={advanced}>
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Link2 className="size-4 text-muted-foreground" />
                    Add records (optional)
                  </span>
                  <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="space-y-4 border-t border-border p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="url" className="flex items-center gap-1.5">
                      <Globe className="size-3.5" /> Website
                    </Label>
                    <Input
                      id="url"
                      value={records.url ?? ''}
                      onChange={(e) => setRecords((r) => ({ ...r, url: e.target.value }))}
                      placeholder="https://example.com"
                      type="url"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tw" className="flex items-center gap-1.5">
                      <AtSign className="size-3.5" /> Twitter / X
                    </Label>
                    <Input
                      id="tw"
                      value={records.twitter ?? ''}
                      onChange={(e) => setRecords((r) => ({ ...r, twitter: e.target.value.replace(/^@/, '') }))}
                      placeholder="yourhandle"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-sm border border-border-muted bg-secondary/40 px-3 py-2">
                    <div className="text-sm">
                      <p className="font-medium">Link this account&apos;s public key</p>
                      <p className="text-xs text-muted-foreground">Point the name at your address.</p>
                    </div>
                    <Button
                      variant={records.linkedPubkey ? 'success' : 'outline'}
                      size="sm"
                      onClick={() =>
                        setRecords((r) => ({
                          ...r,
                          linkedPubkey: r.linkedPubkey ? undefined : account?.address,
                        }))
                      }
                    >
                      {records.linkedPubkey ? 'Linked' : 'Link'}
                    </Button>
                  </div>
                </div>
              </details>

              {/* Address preview */}
              {preview && (
                <div className="space-y-2 rounded-sm bg-secondary/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">These addresses will be registered:</p>
                  <AddressRow label="Root name address" value={preview.rootAddress} />
                  <AddressRow label="Subdomain address" value={preview.subdomainAddress} />
                </div>
              )}

              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                onClick={handleClaim}
                loading={busy}
                disabled={busy || !rootValid || !subValid}
              >
                {busy ? (
                  <>
                    <Loader2 className="animate-spin" /> Registering your name…
                  </>
                ) : (
                  <>
                    <Tag /> Claim {rootValid && subValid ? `${subdomain}.${root}` : 'my name'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-success/40">
            <CardContent className="space-y-4 p-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">You now own</p>
                <p className="font-mono text-2xl font-bold text-brand">{name.fullName}</p>
                <Badge variant={name.onChain ? 'success' : 'secondary'} className="mt-2">
                  {name.onChain ? 'Registered on-chain' : 'Reserved (preview)'}
                </Badge>
              </div>
              <div className="space-y-2">
                <AddressRow label="Root name address" value={name.rootAddress} href={accountUrl(name.rootAddress)} />
                <AddressRow label="Subdomain address" value={name.subdomainAddress} href={accountUrl(name.subdomainAddress)} />
                {name.signature && <AddressRow label="Transaction" value={name.signature} href={txUrl(name.signature)} />}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  dispatch({ type: 'setName', name: null });
                  setPhase('idle');
                }}
              >
                Claim a different name
              </Button>
            </CardContent>
          </Card>
        )}

        <StepNav
          onBack={() => dispatch({ type: 'back' })}
          onNext={() => dispatch({ type: 'next' })}
          nextDisabled={busy}
          nextLabel={name ? 'Finish' : 'Skip & finish'}
        />
      </div>
    </StepMotion>
  );
}
