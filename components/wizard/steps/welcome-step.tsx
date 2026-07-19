'use client';

import { motion } from 'framer-motion';
import { KeyRound, Coins, Rocket, Tag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWizard } from '../wizard-context';
import { StepMotion } from '../step-parts';
import { thruConfig } from '@/lib/thru/config';

const HIGHLIGHTS = [
  { icon: KeyRound, tag: 'KEYS', title: 'Create an account', text: 'Ed25519 keypair, generated on your device.' },
  { icon: Coins, tag: 'GAS', title: 'Pull test tokens', text: 'Free faucet drip to pay for transactions.' },
  { icon: Rocket, tag: 'SHIP', title: 'Deploy a program', text: 'A token or sample program, one click.' },
  { icon: Tag, tag: 'NAME', title: 'Claim a name', text: 'Human-readable root + subdomain.' },
];

export function WelcomeStep() {
  const { dispatch } = useWizard();

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
            Language-agnostic L1 · No CLI · No extensions
          </motion.p>

          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Start getting real
            <br className="hidden sm:block" /> on <span className="text-brand">Thru</span> in 60 seconds
          </h1>

          <p className="mx-auto max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Thru is an L1 built close to the metal. This is the shortest path onto it: spin up an
            account, pull test tokens, ship your first program, and claim your name — all on{' '}
            {thruConfig.network}, no command line required.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              variant="gradient"
              size="lg"
              className="group w-full gap-2 text-base sm:w-auto"
              onClick={() => dispatch({ type: 'next' })}
            >
              Start now
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
              <a href={thruConfig.docsUrl} target="_blank" rel="noreferrer">
                Read the docs
              </a>
            </Button>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Free · Testnet only · Keys never leave your device
          </p>
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
