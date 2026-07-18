'use client';

import { SlidersHorizontal } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useWizard } from './wizard-context';
import { thruConfig } from '@/lib/thru/config';

export function AdvancedToggle() {
  const { advanced, dispatch } = useWizard();
  return (
    <div className="flex items-center justify-between gap-4 rounded-sm border border-border-muted bg-secondary/40 px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <SlidersHorizontal className="size-4" />
        <span className="label-mono">
          Advanced mode
          {advanced && (
            <span className="ml-2 font-mono text-xs">
              · RPC {new URL(thruConfig.rpcUrl).host} · chain {thruConfig.chainId}
            </span>
          )}
        </span>
      </div>
      <Switch checked={advanced} onCheckedChange={(v) => dispatch({ type: 'setAdvanced', value: v })} />
    </div>
  );
}
