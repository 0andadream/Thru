import { ShieldAlert } from 'lucide-react';
import { thruConfig } from '@/lib/thru/config';

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border/60 bg-background/60">
      <div className="container flex flex-col gap-6 py-8">
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="space-y-1">
            <p className="font-semibold text-warning">This is {thruConfig.network} testnet.</p>
            <p className="text-muted-foreground">
              Test tokens have <strong>no monetary value</strong> and the network may be reset at any
              time. Never send real funds here. Thru Onboard is an unofficial community tool: it
              generates keys entirely in your browser and never transmits or stores your private key
              on any server.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <p>Built for the Thru community · Open-source onboarding wizard</p>
          <div className="flex items-center gap-4">
            <a href="https://docs.thru.org" target="_blank" rel="noreferrer" className="hover:text-foreground">
              Docs
            </a>
            <a href={thruConfig.explorerUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
              Explorer
            </a>
            <a href="https://github.com/thru" target="_blank" rel="noreferrer" className="hover:text-foreground">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
