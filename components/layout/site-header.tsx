'use client';

import * as React from 'react';
import { BookOpen, Compass, Download, Wallet } from 'lucide-react';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { WalletPanel } from './wallet-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWizard } from '@/components/wizard/wizard-context';
import { useWalletGate } from '@/components/wizard/use-wallet-gate';
import { thruConfig } from '@/lib/thru/config';

const LINKS = [
  { href: thruConfig.docsUrl, label: 'Docs', icon: BookOpen },
  { href: thruConfig.explorerUrl, label: 'Explorer', icon: Compass },
];

export function SiteHeader() {
  const { account } = useWizard();
  const { creating, createWallet, importWallet } = useWalletGate();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-foreground bg-background/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo />
          <Badge variant="outline" className="hidden sm:inline-flex">
            {thruConfig.network} · Testnet
          </Badge>
        </div>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => (
            <Button key={link.label} variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <a href={link.href} target="_blank" rel="noreferrer noopener">
                <link.icon className="size-4" />
                {link.label}
              </a>
            </Button>
          ))}
          {account ? (
            <WalletPanel />
          ) : (
            <div className="relative" ref={menuRef}>
              <Button
                size="sm"
                variant="gradient"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-haspopup="dialog"
              >
                <Wallet /> Connect
              </Button>
              {open && (
                <div
                  role="dialog"
                  aria-label="Connect a wallet"
                  className="absolute right-0 top-11 z-50 w-[min(18rem,calc(100vw-1.5rem))] space-y-3 rounded-sm border border-border bg-background p-4 text-left shadow-hard"
                >
                  <div>
                    <p className="text-sm font-semibold">Connect a wallet</p>
                    <p className="text-xs text-muted-foreground">
                      {thruConfig.network} · chain {thruConfig.chainId}. A key is created only when you choose Create wallet.
                    </p>
                  </div>
                  <Button variant="gradient" className="w-full" onClick={() => void createWallet()} loading={creating}>
                    <Wallet /> Create wallet
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setOpen(false);
                      importWallet();
                    }}
                    disabled={creating}
                  >
                    <Download /> Import wallet
                  </Button>
                </div>
              )}
            </div>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
