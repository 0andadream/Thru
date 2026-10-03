'use client';

import * as React from 'react';
import { Flame, Loader2, Lock, LockOpen, Plus, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { formatBalance } from '@/lib/thru/account';
import { parseDisplayAmount } from '@/lib/thru/amount';
import { getThru } from '@/lib/thru/client';
import { submitTokenAction, type TokenAction } from '@/lib/thru/token-actions';
import type { DeployResult, ThruAccount } from '@/lib/thru/types';

interface MintView {
  decimals: number;
  supply: bigint;
  ticker: string;
  mintAuthority: string;
  freezeAuthority: string | null;
  hasFreezeAuthority: boolean;
  balance: bigint;
  frozen: boolean;
}

export function TokenManager({ account, deployment }: { account: ThruAccount; deployment: DeployResult }) {
  const { toast } = useToast();
  const [view, setView] = React.useState<MintView | null>(null);
  const [closed, setClosed] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [busy, setBusy] = React.useState<TokenAction | null>(null);
  const tokenAccount = deployment.bufferAddress;

  const refresh = React.useCallback(async () => {
    if (!tokenAccount) return;
    const { parseMintAccountData, parseTokenAccountData, ZERO_PUBKEY } = await import('@thru/programs/token');
    const { encodeAddress } = await import('@thru/sdk/helpers');
    let mintAccount;
    let holderAccount;
    try {
      [mintAccount, holderAccount] = await Promise.all([
        getThru().accounts.get(deployment.metaAddress),
        getThru().accounts.get(tokenAccount),
      ]);
    } catch (error) {
      const message = String((error as { message?: string })?.message ?? error).toLowerCase();
      if (message.includes('not_found') || message.includes('not found')) {
        setClosed(true);
        setView(null);
        return;
      }
      throw error;
    }
    const holder = parseTokenAccountData(holderAccount);
    if (holder.mint === encodeAddress(ZERO_PUBKEY)) {
      setClosed(true);
      setView(null);
      return;
    }
    const mint = parseMintAccountData(mintAccount);
    setView({
      decimals: mint.decimals,
      supply: mint.supply,
      ticker: mint.ticker,
      mintAuthority: mint.mintAuthority,
      freezeAuthority: mint.freezeAuthority,
      hasFreezeAuthority: mint.hasFreezeAuthority,
      balance: holder.amount,
      frozen: holder.isFrozen,
    });
  }, [deployment.metaAddress, tokenAccount]);

  React.useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  if (!tokenAccount || !deployment.onChain) return null;

  const canMint = view?.mintAuthority === account.address;
  const canFreeze = Boolean(view?.hasFreezeAuthority && view.freezeAuthority === account.address);
  const ticker = view?.ticker || deployment.details?.Ticker || '';

  async function run(kind: TokenAction) {
    if (!tokenAccount) return;
    setBusy(kind);
    try {
      const raw = kind === 'mint_to' || kind === 'burn' ? parseDisplayAmount(amount, view?.decimals ?? 0) : undefined;
      await submitTokenAction(account, {
        kind,
        mint: deployment.metaAddress,
        tokenAccount,
        amount: raw,
      });
      if (kind === 'mint_to' || kind === 'burn') setAmount('');
      await refresh();
      toast({ variant: 'success', title: actionTitle(kind) });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Token action failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Token controls</p>
            <p className="text-xs text-muted-foreground">
              Mint, burn, freeze, thaw, or close {ticker || 'this token'} from this wallet.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refresh().catch(() => undefined)} aria-label="Refresh token">
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-sm bg-secondary/40 p-3">
            <p className="text-muted-foreground">Your balance</p>
            <p className="font-mono font-semibold">{view ? formatBalance(view.balance, view.decimals) : '—'}</p>
          </div>
          <div className="rounded-sm bg-secondary/40 p-3">
            <p className="text-muted-foreground">Total supply</p>
            <p className="font-mono font-semibold">{view ? formatBalance(view.supply, view.decimals) : '—'}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {view?.frozen ? 'This token account is frozen.' : 'This token account can send and burn.'}
          {canMint ? ' This wallet is the mint authority.' : ' This wallet cannot mint more.'}
          {canFreeze ? ' This wallet is the freeze authority.' : ''}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(cleanAmount(event.target.value))}
            placeholder={view ? `Amount${ticker ? ` (${ticker})` : ''}` : 'Amount'}
            aria-label="Token amount"
          />
          <Button disabled={!!busy || !amount || !canMint || view?.frozen} onClick={() => run('mint_to')}>
            {busy === 'mint_to' ? <Loader2 className="animate-spin" /> : <Plus />} Mint
          </Button>
          <Button
            variant="outline"
            disabled={!!busy || !amount || view?.frozen || (view ? parseSafe(amount, view.decimals) > view.balance : false)}
            onClick={() => run('burn')}
          >
            {busy === 'burn' ? <Loader2 className="animate-spin" /> : <Flame />} Burn
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={!!busy || !canFreeze || view?.frozen} onClick={() => run('freeze_account')}>
            {busy === 'freeze_account' ? <Loader2 className="animate-spin" /> : <Lock />} Freeze account
          </Button>
          <Button variant="outline" size="sm" disabled={!!busy || !canFreeze || !view?.frozen} onClick={() => run('thaw_account')}>
            {busy === 'thaw_account' ? <Loader2 className="animate-spin" /> : <LockOpen />} Thaw account
          </Button>
          <Button variant="outline" size="sm" disabled={!!busy || view?.balance !== 0n} onClick={() => run('close_account')}>
            {busy === 'close_account' ? <Loader2 className="animate-spin" /> : <X />} Close account
          </Button>
        </div>
        {closed && <p className="text-xs text-muted-foreground">This token account is closed.</p>}
        <p className="text-xs text-muted-foreground">Close is available after the balance is zero. Burn the remaining tokens first.</p>
      </CardContent>
    </Card>
  );
}

function actionTitle(kind: TokenAction): string {
  switch (kind) {
    case 'mint_to':
      return 'Supply minted';
    case 'burn':
      return 'Tokens burned';
    case 'freeze_account':
      return 'Token account frozen';
    case 'thaw_account':
      return 'Token account thawed';
    case 'close_account':
      return 'Token account closed';
  }
}

function cleanAmount(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  return dot === -1 ? cleaned : `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`;
}

function parseSafe(value: string, decimals: number): bigint {
  try {
    return parseDisplayAmount(value, decimals);
  } catch {
    return 0n;
  }
}
