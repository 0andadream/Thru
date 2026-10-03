'use client';

import * as React from 'react';
import { ArrowUpRight, Copy, RefreshCw, Send, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useWizard } from '@/components/wizard/wizard-context';
import { formatBalance, getAccountSnapshot } from '@/lib/thru/account';
import { parseDisplayAmount } from '@/lib/thru/amount';
import { getThru } from '@/lib/thru/client';
import { sendTokens } from '@/lib/thru/transfer';

interface TokenView {
  mint: string;
  tokenAccount: string;
  label: string;
  ticker: string;
  decimals: number;
  balance: bigint | null;
}

export function WalletPanel() {
  const { account, deployments } = useWizard();
  const { toast } = useToast();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [nativeBalance, setNativeBalance] = React.useState<bigint | null>(null);
  const [tokens, setTokens] = React.useState<TokenView[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [action, setAction] = React.useState<'send' | 'receive' | null>(null);
  const [selectedMint, setSelectedMint] = React.useState('');
  const [recipient, setRecipient] = React.useState('');
  const [sendAmount, setSendAmount] = React.useState('');
  const [sending, setSending] = React.useState<'creating' | 'sending' | null>(null);

  const launched = React.useMemo(
    () => deployments.filter((item) => item.kind === 'token' && item.bufferAddress && item.onChain),
    [deployments],
  );

  const refresh = React.useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      try {
        const native = await getAccountSnapshot(account.address);
        setNativeBalance(native.balance);
      } catch {
        setNativeBalance(null);
      }
      const { parseMintAccountData, parseTokenAccountData } = await import('@thru/programs/token');
      const next = await Promise.all(
        launched.map(async (item): Promise<TokenView> => {
          const base = {
            mint: item.metaAddress,
            tokenAccount: item.bufferAddress!,
            label: item.label,
            ticker: item.details?.Ticker ?? '',
            decimals: Number(item.details?.Decimals ?? 0),
            balance: null as bigint | null,
          };
          try {
            const [mintAccount, holderAccount] = await Promise.all([
              getThru().accounts.get(item.metaAddress),
              getThru().accounts.get(item.bufferAddress!),
            ]);
            const mint = parseMintAccountData(mintAccount);
            const holder = parseTokenAccountData(holderAccount);
            return {
              ...base,
              ticker: mint.ticker || base.ticker,
              decimals: mint.decimals,
              balance: holder.amount,
            };
          } catch {
            return base;
          }
        }),
      );
      setTokens(next);
    } finally {
      setLoading(false);
    }
  }, [account, launched]);

  React.useEffect(() => {
    if (open) refresh().catch(() => undefined);
  }, [open, refresh]);

  React.useEffect(() => {
    if (!selectedMint && tokens[0]) setSelectedMint(tokens[0].mint);
  }, [selectedMint, tokens]);

  React.useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
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

  if (!account) return null;

  const selected = tokens.find((item) => item.mint === selectedMint) ?? tokens[0];

  async function sendToken() {
    if (!account || !selected) return;
    setSending('sending');
    try {
      const amount = parseDisplayAmount(sendAmount, selected.decimals);
      const result = await sendTokens(account, {
        mintAddress: selected.mint,
        sourceTokenAccount: selected.tokenAccount,
        recipient,
        amount,
        onStatus: setSending,
      });
      setRecipient('');
      setSendAmount('');
      await refresh();
      toast({
        variant: 'success',
        title: result.createdAccount ? 'Token account created and tokens sent' : 'Tokens sent',
      });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Could not send tokens',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSending(null);
    }
  }

  function onAmountChange(value: string) {
    const cleaned = value.replace(/[^\d.]/g, '');
    const dot = cleaned.indexOf('.');
    setSendAmount(dot === -1 ? cleaned : `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`);
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)} className="font-mono" aria-expanded={open}>
        <Wallet className="size-4" />
        {account.address.slice(0, 6)}…{account.address.slice(-4)}
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Wallet"
          className="absolute right-0 top-11 z-50 max-h-[min(32rem,calc(100dvh-5rem))] w-[min(20rem,calc(100vw-1.5rem))] space-y-4 overflow-y-auto rounded-sm border border-border bg-background p-5 shadow-hard"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Main wallet</p>
            <Button variant="ghost" size="sm" onClick={() => refresh().catch(() => undefined)} disabled={loading} aria-label="Refresh balances">
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
          </div>

          <div className="py-2 text-center">
            <p className="text-xs text-muted-foreground">Native balance</p>
            <p className="font-mono text-3xl font-bold">{nativeBalance === null ? '—' : `${formatBalance(nativeBalance)} THRU`}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setAction('send')} className="flex flex-col items-center gap-2 rounded-sm bg-secondary p-4 text-sm font-semibold hover:bg-secondary/70">
              <Send className="size-5 text-primary" />
              Send
            </button>
            <button type="button" onClick={() => setAction('receive')} className="flex flex-col items-center gap-2 rounded-sm bg-secondary p-4 text-sm font-semibold hover:bg-secondary/70">
              <Copy className="size-5 text-primary" />
              Receive
            </button>
          </div>

          {action === 'receive' && (
            <div className="space-y-3 rounded-sm border border-border p-3">
              <ReceiveRow label="Native THRU" value={account.address} />
              {tokens.map((item) => (
                <ReceiveRow
                  key={item.mint}
                  label={`${item.label}${item.ticker ? ` (${item.ticker})` : ''}`}
                  value={item.tokenAccount}
                />
              ))}
            </div>
          )}

          {action === 'send' && (
            <div className="space-y-2 rounded-sm border border-border p-3">
              <p className="text-xs font-medium">Send tokens</p>
              {tokens.length === 0 ? (
                <p className="text-xs text-muted-foreground">Launch a token before sending one from this wallet.</p>
              ) : (
                <>
                  <label className="sr-only" htmlFor="wallet-token">Token</label>
                  <select
                    id="wallet-token"
                    value={selected?.mint ?? ''}
                    onChange={(event) => setSelectedMint(event.target.value)}
                    className="h-10 w-full rounded-sm border border-input bg-background px-3 text-sm"
                  >
                    {tokens.map((item) => (
                      <option key={item.mint} value={item.mint}>
                        {item.label} {item.ticker}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value.trim())}
                    placeholder="Recipient Thru address"
                    aria-label="Recipient Thru address"
                    className="font-mono text-xs"
                  />
                  <Input
                    value={sendAmount}
                    onChange={(event) => onAmountChange(event.target.value)}
                    inputMode="decimal"
                    placeholder={selected ? `Amount${selected.ticker ? ` (${selected.ticker})` : ''}` : 'Amount'}
                    aria-label="Amount"
                  />
                  {selected && (
                    <p className="text-xs text-muted-foreground">
                      Available {selected.balance === null ? '—' : formatBalance(selected.balance, selected.decimals)} {selected.ticker}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Paste their Thru address or token account. A missing token account is created, then the tokens are sent.
                  </p>
                  <Button size="sm" className="w-full" onClick={sendToken} disabled={!!sending || !selected || !recipient || !sendAmount}>
                    <ArrowUpRight />
                    {sending === 'creating' ? 'Creating account…' : sending === 'sending' ? 'Sending…' : 'Send token'}
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold">Tokens</p>
            {tokens.length === 0 && <p className="text-xs text-muted-foreground">No launched tokens yet.</p>}
            {tokens.map((item) => (
              <div key={item.mint} className="rounded-sm bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">
                  {item.label}
                  {item.ticker ? ` (${item.ticker})` : ''}
                </p>
                <p className="font-mono font-semibold">
                  {item.balance === null ? '—' : formatBalance(item.balance, item.decimals)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiveRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="break-all font-mono text-xs">{value}</p>
      </div>
      <CopyButton value={value} aria-label={`Copy ${label}`} />
    </div>
  );
}
