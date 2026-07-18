'use client';

import { motion } from 'framer-motion';
import { KeyRound, Rocket, Sparkles, Coins, Tag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWizard } from '../wizard-context';
import { StepMotion } from '../step-parts';
import { thruConfig } from '@/lib/thru/config';

const HIGHLIGHTS = [
  { icon: KeyRound, title: 'Create an account', text: 'A secure wallet, generated in your browser.' },
  { icon: Coins, title: 'Get test tokens', text: 'Free faucet drip to pay for transactions.' },
  { icon: Rocket, title: 'Deploy a program', text: 'Launch a token or sample program in one click.' },
  { icon: Tag, title: 'Claim a name', text: 'Register a human-readable name + subdomain.' },
];

export function WelcomeStep() {
  const { dispatch } = useWizard();

  return (
    <StepMotion>
      <div className="relative mx-auto max-w-3xl space-y-10 text-center">
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className="flex justify-center"
          >
            <Badge variant="default" className="gap-1.5 px-3 py-1 text-sm">
              <Sparkles className="size-3.5" />
              No wallet extension needed
            </Badge>
          </motion.div>

          <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
            Get started on <span className="text-gradient">Thru</span>
            <br className="hidden sm:block" /> in 60 seconds
          </h1>

          <p className="mx-auto max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            A friendly, guided setup for the {thruConfig.network} network. Create an account, grab
            test tokens, deploy your first program, and claim your name — all without touching a
            command line.
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
              <a href="https://docs.thru.org" target="_blank" rel="noreferrer">
                Read the docs
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Free · Testnet only · Your keys never leave your device
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
          {HIGHLIGHTS.map((h, i) => (
            <motion.div
              key={h.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <h.icon className="size-5" />
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
