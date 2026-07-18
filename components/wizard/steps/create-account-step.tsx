'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { useToast } from '@/components/ui/toast';
import { useWizard } from '../wizard-context';
import { AddressRow, StepHeading, StepMotion, StepNav } from '../step-parts';
import { downloadKeystore, generateAccount, privateKeyText } from '@/lib/thru/keys';
import { createPasskey, isPasskeySupported } from '@/lib/thru/passkey';
import { accountUrl } from '@/lib/thru/explorer';
import { popSuccess } from '@/lib/confetti';

export function CreateAccountStep() {
  const { account, keyBackedUp, passkey, dispatch } = useWizard();
  const { toast } = useToast();
  const [generating, setGenerating] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState(false);
  const [passkeyBusy, setPasskeyBusy] = React.useState(false);
  const passkeySupported = React.useMemo(() => isPasskeySupported(), []);

  React.useEffect(() => {
    // Auto-generate on first entry if there's no account yet.
    if (!account && !generating) {
      void handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setRevealed(false);
    setDownloaded(false);
    try {
      const acct = await generateAccount();
      dispatch({ type: 'setAccount', account: acct });
      dispatch({ type: 'setBackedUp', value: false });
      dispatch({ type: 'setPasskey', passkey: null });
      popSuccess(0.5, 0.4);
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not generate a key',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    if (!account) return;
    downloadKeystore(account);
    setDownloaded(true);
    dispatch({ type: 'setBackedUp', value: true });
    toast({
      variant: 'success',
      title: 'Backup downloaded',
      description: 'Store this JSON file somewhere safe and private.',
    });
  }

  async function handlePasskey() {
    if (!account) return;
    setPasskeyBusy(true);
    try {
      const info = await createPasskey(`thru-${account.address.slice(2, 8)}`, account.address);
      dispatch({ type: 'setPasskey', passkey: info });
      toast({ variant: 'success', title: 'Passkey created', description: 'Future signing just got easier.' });
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Passkey setup cancelled',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <StepMotion>
      <div className="mx-auto max-w-2xl space-y-6">
        <StepHeading
          eyebrow="Step 1"
          title="Create your Thru account"
          description="Your keys are generated right here in your browser and never sent anywhere. Back them up before moving on."
        />

        {/* Public key / address */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="size-4 text-primary" />
                Your public address
              </div>
              <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Regenerate
              </Button>
            </div>

            {generating || !account ? (
              <div className="flex h-[62px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" /> Generating a secure keypair…
              </div>
            ) : (
              <AddressRow label="Public address (safe to share)" value={account.address} href={accountUrl(account.address)} />
            )}
          </CardContent>
        </Card>

        {/* Private key */}
        {account && !generating && (
          <Card className="border-destructive/30">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-destructive">
                    Your private key is the master key to this account.
                  </p>
                  <p className="text-muted-foreground">
                    Anyone who sees it can take everything. Never share it, never paste it into a
                    website, and never store it in a screenshot or chat. Thru Onboard cannot recover
                    it for you.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Private key</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setRevealed((v) => !v)}>
                      {revealed ? <EyeOff /> : <Eye />}
                      {revealed ? 'Hide' : 'Reveal'}
                    </Button>
                    <CopyButton value={privateKeyText(account)} label="Copy private key" />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-3">
                  <code className="block break-all font-mono text-xs">
                    {revealed
                      ? privateKeyText(account)
                      : '•'.repeat(64)}
                  </code>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant={downloaded ? 'success' : 'default'}
                  size="lg"
                  onClick={handleDownload}
                  className="w-full"
                >
                  {downloaded ? <ShieldCheck /> : <Download />}
                  {downloaded ? 'Backup saved' : 'Download private key'}
                </Button>
                <CopyButton
                  value={privateKeyText(account)}
                  label="Copy to clipboard"
                  variant="outline"
                  showValue
                  className="h-14 w-full rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Optional passkey */}
        {account && !generating && passkeySupported && (
          <Card>
            <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Fingerprint className="size-5" />
                </div>
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    Add a passkey
                    <Badge variant="secondary">Optional</Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Use Face ID, Touch ID, or your device PIN for easier signing later.
                  </p>
                </div>
              </div>
              <Button
                variant={passkey ? 'success' : 'outline'}
                onClick={handlePasskey}
                loading={passkeyBusy}
                disabled={!!passkey}
                className="w-full shrink-0 sm:w-auto"
              >
                {passkey ? <ShieldCheck /> : <Fingerprint />}
                {passkey ? 'Passkey added' : 'Create passkey'}
              </Button>
            </CardContent>
          </Card>
        )}

        <StepNav
          onBack={() => dispatch({ type: 'back' })}
          onNext={() => dispatch({ type: 'next' })}
          nextDisabled={!account || generating || !keyBackedUp}
          nextLabel={keyBackedUp ? 'I saved my key — continue' : 'Download your key to continue'}
        />
        {!keyBackedUp && account && !generating && (
          <p className="text-center text-xs text-muted-foreground">
            Download the backup file to unlock the next step.
          </p>
        )}
      </div>
    </StepMotion>
  );
}
