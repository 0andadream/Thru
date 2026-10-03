'use client';

import { motion } from 'framer-motion';
import { KeyRound, Coins, Rocket, Wallet, ArrowRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWizard } from '../wizard-context';
import { useWalletGate } from '../use-wallet-gate';
import { StepMotion } from '../step-parts';
import { thruConfig } from '@/lib/thru/config';

const HIGHLIGHTS = [
  { icon: Wallet, tag: 'WALLET', title: 'Your keys', text: 'Create or import a wallet. Nothing is generated until you click.' },
  { icon: Coins, tag: 'FUND', title: 'Betanet THRU', text: 'Claim test tokens from the on-chain faucet.' },
  { icon: Rocket, tag: 'TOKEN', title: 'Launch and trade', text: 'Mint, send, burn, freeze, or close a token you control.' },
  { icon: KeyRound, tag: 'NAME', title: 'Register a name', text: 'Create a name-service root and a name under it.' },
];

export function WelcomeStep() {
  const { account, keyBackedUp, dispatch } = useWizard();
  const { creating, createWallet, importWallet } = useWalletGate();

  return (
    <StepMotion>
      <div className="relative mx-auto max-w-3xl space-y-10 text-center">
        <div className="space-y-6">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="label-mono text-primary"
          >
            {thruConfig.network} wallet · Keys stay on this device
          </motion.p>

          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            A wallet for <span className="text-brand">Thru</span>
          </h1>

          <p className="mx-auto max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Create a wallet or import one you already have. Then fund it, launch a token, and
            use it on {thruConfig.network}. No extension and no command line.
          </p>

          <div className="mx-auto max-w-md space-y-4 rounded-sm border border-foreground bg-card p-5 text-left shadow-hard-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="label-mono inline-flex items-center gap-2 text-primary">
                <span className={`size-2 rounded-full ${account ? 'bg-success' : 'bg-warning'}`} />
                {account ? 'Connected' : 'Not connected'}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {thruConfig.network} · chain {thruConfig.chainId}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wallet</p>
              <p className="truncate font-mono text-sm">
                {account ? account.address : 'No wallet on this device'}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {account ? (
                <Button
                  variant="gradient"
                  size="lg"
                  className="w-full"
                  onClick={() => dispatch({ type: 'goto', index: keyBackedUp ? 2 : 1 })}
                >
                  Open wallet
                  <ArrowRight />
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  size="lg"
                  className="w-full"
                  onClick={() => void createWallet()}
                  loading={creating}
                >
                  <Wallet /> Create wallet
                </Button>
              )}
              <Button variant="outline" size="lg" className="w-full" onClick={importWallet} disabled={creating}>
                <Download /> Import wallet
              </Button>
            </div>
            {account ? (
              <Button variant="ghost" className="w-full" onClick={() => void createWallet()} loading={creating}>
                Create a new wallet
              </Button>
            ) : (
              <p className="text-center font-mono text-[11px] text-muted-foreground">
                Nothing is generated until you click Create wallet.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
          {HIGHLIGHTS.map((h, i) => (
            <motion.div
              key={h.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="group flex items-start gap-3 rounded-sm border border-foreground bg-card p-4 transition-all hover:-translate-y-px hover:shadow-hard-sm"
            >
              <div className="flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-sm border border-foreground bg-secondary text-primary">
                <h.icon className="size-4" />
                <span className="font-mono text-[8px] font-bold tracking-wider text-foreground">{h.tag}</span>
              </div>
              <div>
                <p className="font-semibold">{h.title}</p>
                <p className="text-sm text-muted-foreground">{h.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </StepMotion>
  );
}
