'use client';

import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { STEPS, useWizard } from './wizard-context';

export function Stepper() {
  const { stepIndex, dispatch, account, funded, deployment } = useWizard();

  // Which steps are reachable by clicking (only ones already unlocked).
  const canJumpTo = (i: number): boolean => {
    if (i <= stepIndex) return true;
    if (i === 1) return true; // create account
    if (i === 2) return !!account;
    if (i === 3) return !!account && funded;
    if (i === 4) return !!account && !!deployment;
    return false;
  };

  // Progress excludes the welcome + success bookends for a cleaner feel.
  const total = STEPS.length - 1;
  const pct = Math.min(100, Math.round((stepIndex / total) * 100));

  return (
    <div className="space-y-4">
      <div className="hidden items-center justify-between md:flex">
        {STEPS.map((step, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          const jumpable = canJumpTo(i);
          return (
            <div key={step.id} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={!jumpable}
                onClick={() => jumpable && dispatch({ type: 'goto', index: i })}
                className={cn(
                  'group flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors',
                  jumpable ? 'cursor-pointer hover:bg-secondary' : 'cursor-not-allowed opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                    done && 'border-primary bg-primary text-primary-foreground',
                    active && 'border-primary bg-primary/10 text-primary',
                    !done && !active && 'border-border text-muted-foreground',
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.title}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                  <motion.div
                    className="h-full bg-primary"
                    initial={false}
                    animate={{ width: done ? '100%' : '0%' }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Compact mobile view */}
      <div className="space-y-2 md:hidden">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{STEPS[stepIndex].title}</span>
          <span className="text-muted-foreground">
            Step {Math.min(stepIndex + 1, total)} of {total}
          </span>
        </div>
        <Progress value={pct} />
      </div>
    </div>
  );
}
