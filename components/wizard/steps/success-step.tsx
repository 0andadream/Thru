'use client';

import * as React from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Coins,
  KeyRound,
  RotateCcw,
  Tag,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { clearWizardStorage, useWizard } from '../wizard-context';
import { AddressRow, StepHeading, StepMotion } from '../step-parts';
import { celebrate } from '@/lib/confetti';
import { accountUrl } from '@/lib/thru/explorer';
import { thruConfig } from '@/lib/thru/config';

export function SuccessStep() {
  const { account, funded, deployment, name, passkey, dispatch } = useWizard();
  const { toast } = useToast();

  React.useEffect(() => {
    celebrate();
  }, []);

  function startOver() {
    clearWizardStorage();
    dispatch({ type: 'reset' });
    toast({ title: 'Fresh start', description: 'Wizard reset. A new account will be generated.' });
  }

  const checklist = [
    { icon: KeyRound, label: 'Account created', done: !!account },
    { icon: Coins, label: 'Test tokens received', done: funded },
    { icon: Wallet, label: 'Program deployed', done: !!deployment },
    { icon: Tag, label: 'Name claimed', done: !!name },
  ];

  return (
    <StepMotion>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30"
          >
            <CheckCircle2 className="size-9" />
          </motion.div>
          <StepHeading
            title="You're all set on Thru! 🎉"
            description="Here's everything you created. Bookmark or copy anything you want to keep — especially your key backup."
          />
        </div>

        {/* Checklist */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {checklist.map((c) => (
            <div
              key={c.label}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card/60 p-3 text-center"
            >
              <c.icon className={c.done ? 'size-5 text-success' : 'size-5 text-muted-foreground'} />
              <span className="text-xs font-medium">{c.label}</span>
              <Badge variant={c.done ? 'success' : 'secondary'} className="text-[10px]">
                {c.done ? 'Done' : 'Skipped'}
              </Badge>
            </div>
          ))}
        </div>

        {/* Summary card */}
        <Card>
          <CardContent className="space-y-4 p-6">
            {account && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound className="size-4 text-primary" /> Your account
                </p>
                <AddressRow label="Address" value={account.address} href={accountUrl(account.address)} />
                {passkey?.credentialId && (
                  <p className="text-xs text-muted-foreground">🔐 Passkey enabled for easier signing.</p>
                )}
              </div>
            )}

            {deployment && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Wallet className="size-4 text-primary" /> {deployment.label}{' '}
                  <Badge variant={deployment.onChain ? 'success' : 'secondary'}>
                    {deployment.onChain ? 'On-chain' : 'Preview'}
                  </Badge>
                </p>
                <AddressRow
                  label={deployment.kind === 'token' ? 'Mint address' : 'Program address'}
                  value={deployment.metaAddress}
                  href={accountUrl(deployment.metaAddress)}
                />
              </div>
            )}

            {name && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Tag className="size-4 text-primary" /> Your name
                </p>
                <AddressRow label={name.fullName} value={name.subdomainAddress} href={accountUrl(name.subdomainAddress)} mono={false} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reminder */}
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-warning">One last reminder</p>
          <p className="text-muted-foreground">
            Make sure you saved your private key backup file. It&apos;s the only way to access this
            account — there is no password reset.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" size="lg" asChild className="flex-1">
            <a href={account ? accountUrl(account.address) : thruConfig.explorerUrl} target="_blank" rel="noreferrer">
              View on Explorer <ArrowUpRight className="size-4" />
            </a>
          </Button>
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => dispatch({ type: 'goto', index: 3 })}>
            Do more
          </Button>
          <Button variant="ghost" size="lg" className="flex-1" onClick={startOver}>
            <RotateCcw /> Start over
          </Button>
        </div>
      </div>
    </StepMotion>
  );
}
