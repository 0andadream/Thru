'use client';

import * as React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, truncateMiddle } from '@/lib/utils';
import { CopyButton } from '@/components/ui/copy-button';
import { Button } from '@/components/ui/button';

/** Consistent enter animation for each step's content. */
export function StepMotion({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export function StepHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 text-center">
      {eyebrow && <p className="label-mono text-primary">{eyebrow}</p>}
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {description && (
        <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">{description}</p>
      )}
    </div>
  );
}

/** A labelled, copyable, optionally-explorable address row. */
export function AddressRow({
  label,
  value,
  href,
  mono = true,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-border-muted bg-secondary/50 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="label-mono text-muted-foreground">{label}</p>
        <code className={cn('block truncate text-sm', mono ? 'font-mono' : 'font-sans')} title={value}>
          <span className="sm:hidden">{truncateMiddle(value, 8, 8)}</span>
          <span className="hidden sm:inline">{value}</span>
        </code>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <CopyButton value={value} />
        {href && (
          <Button variant="ghost" size="icon" asChild aria-label="View on explorer">
            <a href={href} target="_blank" rel="noreferrer noopener">
              <ArrowUpRight className="size-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

/** Navigation footer used by most steps. */
export function StepNav({
  onBack,
  onNext,
  nextLabel = 'Continue',
  backLabel = 'Back',
  nextDisabled,
  nextLoading,
  hideBack,
  secondary,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  hideBack?: boolean;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col-reverse items-center gap-3 pt-2 sm:flex-row sm:justify-between">
      <div>
        {!hideBack && onBack && (
          <Button variant="ghost" onClick={onBack}>
            {backLabel}
          </Button>
        )}
      </div>
      <div className="flex w-full items-center gap-3 sm:w-auto">
        {secondary}
        {onNext && (
          <Button
            variant="gradient"
            size="lg"
            className="w-full sm:w-auto"
            onClick={onNext}
            disabled={nextDisabled}
            loading={nextLoading}
          >
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
