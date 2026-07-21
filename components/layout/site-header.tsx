'use client';

import * as React from 'react';
import { BookOpen, Compass, RefreshCw, Wallet } from 'lucide-react';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { thruConfig } from '@/lib/thru/config';
import { useWizard } from '@/components/wizard/wizard-context';
import { getAccountSnapshot, formatBalance } from '@/lib/thru/account';
import { getThru } from '@/lib/thru/client';

const LINKS = [
  { href: thruConfig.docsUrl, label: 'Docs', icon: BookOpen },
  { href: thruConfig.explorerUrl, label: 'Explorer', icon: Compass },
];

export function SiteHeader() {
  const { account, deployments } = useWizard();
  const [open, setOpen] = React.useState(false);
  const [nativeBalance, setNativeBalance] = React.useState<bigint | null>(null);
  const [tokenBalances, setTokenBalances] = React.useState<Record<string, bigint>>({});
  const [loading, setLoading] = React.useState(false);
  const refresh = React.useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const native = await getAccountSnapshot(account.address);
      setNativeBalance(native.balance);
      if (deployments.length) {
        const { parseTokenAccountData } = await import('@thru/programs/token');
        const balances = await Promise.all(deployments.filter((item) => item.kind === 'token' && item.bufferAddress).map(async (item) => [item.metaAddress, parseTokenAccountData(await getThru().accounts.get(item.bufferAddress!)).amount] as const));
        setTokenBalances(Object.fromEntries(balances));
      } else setTokenBalances({});
    } finally { setLoading(false); }
  }, [account, deployments]);
  React.useEffect(() => { if (open) refresh().catch(() => undefined); }, [open, refresh]);
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
          {account && <div className="relative"><Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)} className="font-mono"><Wallet className="size-4" />{account.address.slice(0, 6)}…{account.address.slice(-4)}</Button>{open && <div className="absolute right-0 top-11 z-50 w-72 space-y-3 rounded-sm border border-border bg-background p-4 shadow-hard"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Wallet balance</p><Button variant="ghost" size="sm" onClick={() => refresh().catch(() => undefined)} disabled={loading}><RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /></Button></div><p className="break-all font-mono text-xs text-muted-foreground">{account.address}</p><div className="rounded-sm bg-secondary/50 p-3"><p className="text-xs text-muted-foreground">Native balance</p><p className="font-mono font-semibold">{nativeBalance === null ? '—' : formatBalance(nativeBalance)} THRU</p></div>{deployments.filter((item) => item.kind === 'token').map((item) => <div key={item.metaAddress} className="rounded-sm bg-secondary/50 p-3"><p className="text-xs text-muted-foreground">{item.label} {item.details?.ticker ? `(${item.details.ticker})` : ''}</p><p className="font-mono font-semibold">{tokenBalances[item.metaAddress]?.toString() ?? '—'}</p>{item.bufferAddress && <p className="mt-2 break-all text-[10px] text-muted-foreground">Receive: <span className="font-mono">{item.bufferAddress}</span></p>}</div>)}</div>}</div>}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
