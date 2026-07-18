'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  value: string;
  label?: string;
  /** When set, renders the value alongside the button as a mono field. */
  showValue?: boolean;
}

export function CopyButton({
  value,
  label = 'Copy',
  showValue = false,
  variant = 'ghost',
  size = 'icon',
  className,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for older browsers / insecure contexts.
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* no-op */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [value]);

  const btn = (
    <Button
      type="button"
      variant={variant}
      size={showValue ? 'sm' : size}
      onClick={copy}
      className={cn(showValue && 'gap-1.5', className)}
      aria-label={label}
      {...props}
    >
      {copied ? (
        <Check className="text-success" />
      ) : (
        <Copy />
      )}
      {showValue && <span className="text-xs">{copied ? 'Copied' : label}</span>}
    </Button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent>{copied ? 'Copied!' : label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** A read-only field that displays a value in mono and offers a copy button. */
export function CopyField({
  value,
  label,
  mono = true,
  className,
}: {
  value: string;
  label?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="flex items-center gap-2 rounded-sm border border-border bg-secondary/50 px-3 py-2">
        <code
          className={cn(
            'flex-1 truncate text-sm',
            mono ? 'font-mono' : 'font-sans',
          )}
          title={value}
        >
          {value}
        </code>
        <CopyButton value={value} className="shrink-0" />
      </div>
    </div>
  );
}
