'use client';

import * as React from 'react';
import { CheckCircle2, Cpu, Loader2, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useWizard } from '../wizard-context';
import { AddressRow, StepHeading, StepMotion, StepNav } from '../step-parts';
import { DEPLOY_OPTIONS, deploy, type TokenForm } from '@/lib/thru/deploy';
import type { DeployKind, TxPhase } from '@/lib/thru/types';
import { accountUrl, txUrl } from '@/lib/thru/explorer';
import { popSuccess } from '@/lib/confetti';

const PHASE_LABEL: Record<TxPhase, string> = {
  idle: '',
  building: 'Preparing deployment…',
  signing: 'Signing locally…',
  submitting: 'Submitting to the network…',
  confirming: 'Waiting for confirmation…',
  confirmed: 'Confirmed!',
  error: 'Something went wrong',
};

export function DeployStep() {
  const { account, deployment, dispatch } = useWizard();
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<DeployKind>('token');
  const [phase, setPhase] = React.useState<TxPhase>('idle');
  const [token, setToken] = React.useState<TokenForm>({ name: 'My First Token', ticker: 'MFT', decimals: 6 });

  const busy = phase !== 'idle' && phase !== 'confirmed' && phase !== 'error';
  const option = DEPLOY_OPTIONS.find((o) => o.kind === selected)!;

  async function handleDeploy() {
    if (!account) return;
    setPhase('building');
    try {
      const result = await deploy(account, selected, {
        token: selected === 'token' ? token : undefined,
        onPhase: setPhase,
      });
      dispatch({ type: 'setDeployment', deployment: result });
      setPhase('confirmed');
      popSuccess(0.5, 0.45);
      toast({
        variant: result.warning ? 'warning' : 'success',
        title: result.warning
          ? 'Mint created — initial supply incomplete'
          : result.onChain
            ? 'Deployed on-chain!'
            : 'Deployment prepared',
        description: result.warning
          ? result.warning
          : result.onChain
            ? `${result.label} is live.`
            : `${result.label} — preview addresses generated.`,
        duration: result.warning ? 9000 : undefined,
      });
    } catch (err) {
      setPhase('error');
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ variant: 'error', title: 'Deploy failed', description: msg });
    }
  }

  return (
    <StepMotion>
      <div className="mx-auto max-w-2xl space-y-6">
        <StepHeading
          eyebrow="Step 3"
          title="Deploy your first program"
          description="Pick something to launch on Thru. Each one produces real on-chain addresses you can explore."
        />

        {!deployment ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {DEPLOY_OPTIONS.map((o) => {
                const active = selected === o.kind;
                const onChain = o.onChainAvailable();
                return (
                  <button
                    key={o.kind}
                    type="button"
                    onClick={() => setSelected(o.kind)}
                    disabled={busy}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-sm border p-4 text-left transition-all',
                      active
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                        : 'border-border hover:border-primary/50 hover:bg-secondary/50',
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-2xl">{o.glyph}</span>
                      {active && <CheckCircle2 className="size-5 text-primary" />}
                    </div>
                    <div>
                      <p className="font-semibold">{o.label}</p>
                      <p className="text-xs text-muted-foreground">{o.tagline}</p>
                    </div>
                    <Badge variant={onChain ? 'success' : 'secondary'} className="mt-1">
                      {onChain ? 'On-chain' : 'Preview'}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <Card>
              <CardContent className="space-y-4 p-5">
                <p className="text-sm text-muted-foreground">{option.description}</p>

                {option.needsTokenForm && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="token-name">Token name</Label>
                      <Input
                        id="token-name"
                        value={token.name}
                        maxLength={32}
                        onChange={(e) => setToken((t) => ({ ...t, name: e.target.value }))}
                        placeholder="My First Token"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="token-ticker">Ticker</Label>
                      <Input
                        id="token-ticker"
                        value={token.ticker}
                        maxLength={8}
                        onChange={(e) =>
                          setToken((t) => ({ ...t, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))
                        }
                        placeholder="MFT"
                        className="font-mono"
                      />
                    </div>
                  </div>
                )}

                {!option.onChainAvailable() && (
                  <p className="rounded-sm border border-warning/40 bg-warning/10 p-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-warning">Preview mode.</span> This network
                    build has no {selected === 'token' ? 'token program' : 'program loader'} address
                    configured, so we&apos;ll generate the genuine derived Meta &amp; Buffer addresses
                    without submitting a transaction. Set the address in your environment to enable a
                    real on-chain deploy.
                  </p>
                )}

                <Button
                  variant="gradient"
                  size="lg"
                  className="w-full"
                  onClick={handleDeploy}
                  loading={busy}
                  disabled={busy || (option.needsTokenForm && (!token.name.trim() || !token.ticker.trim()))}
                >
                  {busy ? (
                    <>
                      <Loader2 className="animate-spin" /> {PHASE_LABEL[phase]}
                    </>
                  ) : (
                    <>
                      <Rocket /> Deploy {option.label}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className={deployment.warning ? 'border-warning/40' : 'border-success/40'}>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-sm bg-success/10 text-success">
                  <Cpu className="size-6" />
                </div>
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {deployment.label}
                    <Badge variant={deployment.warning ? 'warning' : deployment.onChain ? 'success' : 'secondary'}>
                      {deployment.warning ? 'Partially deployed' : deployment.onChain ? 'Live on-chain' : 'Preview'}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {deployment.warning ? 'The mint exists, but the initial supply needs attention.' : 'Your program addresses are ready.'}
                  </p>
                </div>
              </div>

              {deployment.warning && (
                <p className="rounded-sm border border-warning/40 bg-warning/10 p-3 text-sm text-muted-foreground">
                  <span className="font-semibold text-warning">Partial deployment.</span>{' '}
                  {deployment.warning}
                </p>
              )}

              <div className="space-y-2">
                <AddressRow
                  label={deployment.kind === 'token' ? 'Mint (Meta) address' : 'Program Meta address'}
                  value={deployment.metaAddress}
                  href={accountUrl(deployment.metaAddress)}
                />
                {deployment.bufferAddress && (
                  <AddressRow
                    label={deployment.kind === 'token' ? 'Your token account (mint destination)' : 'Buffer address'}
                    value={deployment.bufferAddress}
                    href={accountUrl(deployment.bufferAddress)}
                  />
                )}
                {deployment.signature && (
                  <AddressRow label="Transaction" value={deployment.signature} href={txUrl(deployment.signature)} />
                )}
              </div>

              {deployment.details && (
                <dl className="grid gap-2 rounded-sm border border-border-muted bg-secondary/30 p-3 text-xs sm:grid-cols-2">
                  {Object.entries(deployment.details).map(([label, value]) => (
                    <div key={label}>
                      <dt className="label-mono text-muted-foreground">{label}</dt>
                      <dd className="break-all font-mono">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  dispatch({ type: 'setDeployment', deployment: null });
                  setPhase('idle');
                }}
              >
                Deploy something else
              </Button>
            </CardContent>
          </Card>
        )}

        <StepNav
          onBack={() => dispatch({ type: 'back' })}
          onNext={() => dispatch({ type: 'next' })}
          nextDisabled={busy}
          nextLabel={deployment ? 'Continue to naming' : 'Skip for now'}
        />
      </div>
    </StepMotion>
  );
}
