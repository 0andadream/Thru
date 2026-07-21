'use client';

import * as React from 'react';
import { ArrowUpRight, BookOpen, Compass, Copy, RefreshCw, Send, Wallet } from 'lucide-react';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { thruConfig } from '@/lib/thru/config';
import { useWizard } from '@/components/wizard/wizard-context';
import { getAccountSnapshot, formatBalance } from '@/lib/thru/account';
import { getThru } from '@/lib/thru/client';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { buildAndSign, currentSlot, submitWithNonce } from '@/lib/thru/faucet-onchain';
import { publicKeyBytes } from '@/lib/thru/keys';

const LINKS = [
  { href: thruConfig.docsUrl, label: 'Docs', icon: BookOpen },
  { href: thruConfig.explorerUrl, label: 'Explorer', icon: Compass },
];

export function SiteHeader() {
  const { account, deployments } = useWizard();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [nativeBalance, setNativeBalance] = React.useState<bigint | null>(null);
  const [tokenBalances, setTokenBalances] = React.useState<Record<string, bigint>>({});
  const [loading, setLoading] = React.useState(false);
  const [action, setAction] = React.useState<'send' | 'receive' | null>(null);
  const [selectedMint, setSelectedMint] = React.useState('');
  const [recipient, setRecipient] = React.useState('');
  const [sendAmount, setSendAmount] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const tokens = deployments.filter((item) => item.kind === 'token' && item.bufferAddress);
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
  React.useEffect(() => { if (!selectedMint && tokens[0]) setSelectedMint(tokens[0].metaAddress); }, [selectedMint, tokens]);
  async function sendToken() {
    const token = tokens.find((item) => item.metaAddress === selectedMint);
    if (!account || !token?.bufferAddress || !recipient || !/^\d+$/.test(sendAmount) || BigInt(sendAmount) <= 0n) return;
    setSending(true);
    try {
      const { createTransferInstruction } = await import('@thru/programs/token'); const { decodeAddress } = await import('@thru/sdk/helpers');
      const { nonce } = await getAccountSnapshot(account.address); const slot = await currentSlot();
      await submitWithNonce(nonce, (n) => buildAndSign(account, { program: thruConfig.tokenProgramAddress, accounts: { readWrite: [token.bufferAddress!, recipient] }, instructionData: createTransferInstruction({ sourceAccountBytes: decodeAddress(token.bufferAddress!), destinationAccountBytes: decodeAddress(recipient), amount: BigInt(sendAmount) }), header: { fee: 0n, nonce: n, startSlot: slot, expiryAfter: 100, computeUnits: 300_000, memoryUnits: 10_000, stateUnits: 10_000, chainId: thruConfig.chainId } }));
      setRecipient(''); setSendAmount(''); await refresh(); toast({ variant: 'success', title: 'Tokens sent' });
    } catch (err) { toast({ variant: 'error', title: 'Could not send tokens', description: err instanceof Error ? err.message : 'Unknown error' }); } finally { setSending(false); }
  }
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
          {account && <div className="relative"><Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)} className="font-mono"><Wallet className="size-4" />{account.address.slice(0, 6)}…{account.address.slice(-4)}</Button>{open && <div className="absolute right-0 top-11 z-50 w-80 space-y-4 rounded-sm border border-border bg-background p-5 shadow-hard"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Main wallet</p><Button variant="ghost" size="sm" onClick={() => refresh().catch(() => undefined)} disabled={loading}><RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /></Button></div><div className="py-2 text-center"><p className="text-xs text-muted-foreground">Native balance</p><p className="font-mono text-3xl font-bold">{nativeBalance === null ? '—' : formatBalance(nativeBalance)} THRU</p></div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setAction('send')} className="flex flex-col items-center gap-2 rounded-sm bg-secondary p-4 text-sm font-semibold hover:bg-secondary/70"><Send className="size-5 text-primary" />Send</button><button type="button" onClick={() => setAction('receive')} className="flex flex-col items-center gap-2 rounded-sm bg-secondary p-4 text-sm font-semibold hover:bg-secondary/70"><Copy className="size-5 text-primary" />Receive</button></div>{action === 'receive' && <div className="space-y-2 rounded-sm border border-border p-3"><p className="text-xs font-medium">Receive native THRU at</p><p className="break-all font-mono text-xs">{account.address}</p></div>}{action === 'send' && <div className="space-y-2 rounded-sm border border-border p-3"><p className="text-xs font-medium">Send tokens</p><select value={selectedMint} onChange={(event) => setSelectedMint(event.target.value)} className="h-10 w-full rounded-sm border border-input bg-background px-3 text-sm">{tokens.map((item) => <option key={item.metaAddress} value={item.metaAddress}>{item.label} {item.details?.ticker ?? ''}</option>)}</select><Input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Recipient token-account address" /><Input value={sendAmount} onChange={(event) => setSendAmount(event.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Raw amount" /><Button size="sm" className="w-full" onClick={sendToken} disabled={sending || !selectedMint || !recipient || !sendAmount}><ArrowUpRight />{sending ? 'Sending…' : 'Send token'}</Button></div>}<div className="space-y-2"><p className="text-sm font-semibold">Tokens</p>{tokens.map((item) => <div key={item.metaAddress} className="rounded-sm bg-secondary/50 p-3"><p className="text-xs text-muted-foreground">{item.label} {item.details?.ticker ? `(${item.details.ticker})` : ''}</p><p className="font-mono font-semibold">{tokenBalances[item.metaAddress]?.toString() ?? '—'}</p></div>)}</div></div>}</div>}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
