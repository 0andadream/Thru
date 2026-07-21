'use client';

import * as React from 'react';
import { Flame, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { getAccountSnapshot } from '@/lib/thru/account';
import { getThru } from '@/lib/thru/client';
import { thruConfig } from '@/lib/thru/config';
import { buildAndSign, currentSlot, submitWithNonce } from '@/lib/thru/faucet-onchain';
import { publicKeyBytes } from '@/lib/thru/keys';
import type { DeployResult, ThruAccount } from '@/lib/thru/types';

export function TokenManager({ account, deployment }: { account: ThruAccount; deployment: DeployResult }) {
  const { toast } = useToast();
  const [balance, setBalance] = React.useState<bigint | null>(null);
  const [supply, setSupply] = React.useState<bigint | null>(null);
  const [amount, setAmount] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const tokenAccount = deployment.bufferAddress;

  const refresh = React.useCallback(async () => {
    if (!tokenAccount) return;
    const { parseMintAccountData, parseTokenAccountData } = await import('@thru/programs/token');
    const [mint, holder] = await Promise.all([getThru().accounts.get(deployment.metaAddress), getThru().accounts.get(tokenAccount)]);
    setSupply(parseMintAccountData(mint).supply);
    setBalance(parseTokenAccountData(holder).amount);
  }, [deployment.metaAddress, tokenAccount]);

  React.useEffect(() => { refresh().catch(() => undefined); }, [refresh]);

  async function submit(kind: 'mint' | 'burn') {
    if (!tokenAccount || !/^\d+$/.test(amount) || BigInt(amount) <= 0n) return;
    setBusy(true);
    try {
      const { createMintToInstruction, buildTokenInstructionBytes } = await import('@thru/programs/token');
      const mintBytes = (await import('@thru/sdk/helpers')).decodeAddress(deployment.metaAddress);
      const tokenBytes = (await import('@thru/sdk/helpers')).decodeAddress(tokenAccount);
      const ownerBytes = publicKeyBytes(account);
      const { nonce } = await getAccountSnapshot(account.address);
      const slot = await currentSlot();
      await submitWithNonce(nonce, (n) => buildAndSign(account, {
        program: thruConfig.tokenProgramAddress,
        accounts: { readWrite: [deployment.metaAddress, tokenAccount] },
        instructionData: async (ctx) => kind === 'mint'
          ? createMintToInstruction({ mintAccountBytes: mintBytes, destinationAccountBytes: tokenBytes, authorityAccountBytes: ownerBytes, amount: BigInt(amount) })(ctx)
          : buildTokenInstructionBytes('burn', burnPayload(ctx.getAccountIndex(tokenBytes), ctx.getAccountIndex(mintBytes), ctx.getAccountIndex(ownerBytes), BigInt(amount))),
        header: { fee: 0n, nonce: n, startSlot: slot, expiryAfter: 100, computeUnits: 300_000, memoryUnits: 10_000, stateUnits: 10_000, chainId: thruConfig.chainId },
      }));
      setAmount(''); await refresh(); toast({ variant: 'success', title: kind === 'mint' ? 'Supply minted' : 'Tokens burned' });
    } catch (error) { toast({ variant: 'error', title: 'Token action failed', description: error instanceof Error ? error.message : 'Unknown error' }); }
    finally { setBusy(false); }
  }

  if (!tokenAccount || !deployment.onChain) return null;
  return <Card><CardContent className="space-y-4 p-6"><div className="flex items-center justify-between"><div><p className="font-semibold">Token controls</p><p className="text-xs text-muted-foreground">Amounts are raw base units. Only use this for a mint your wallet controls.</p></div><Button variant="ghost" size="sm" onClick={() => refresh().catch(() => undefined)}><RefreshCw className="size-4" /></Button></div><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-sm bg-secondary/40 p-3"><p className="text-muted-foreground">Your balance</p><p className="font-mono font-semibold">{balance?.toString() ?? '—'}</p></div><div className="rounded-sm bg-secondary/40 p-3"><p className="text-muted-foreground">Total supply</p><p className="font-mono font-semibold">{supply?.toString() ?? '—'}</p></div></div><div className="flex gap-2"><Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="Raw amount" /><Button disabled={busy || !amount} onClick={() => submit('mint')}>{busy ? <Loader2 className="animate-spin" /> : <Plus />} Mint more</Button><Button variant="outline" disabled={busy || !amount || (balance !== null && BigInt(amount || '0') > balance)} onClick={() => submit('burn')}>{busy ? <Loader2 className="animate-spin" /> : <Flame />} Burn</Button></div></CardContent></Card>;
}

function burnPayload(token: number, mint: number, authority: number, amount: bigint) {
  const bytes = new Uint8Array(14); const view = new DataView(bytes.buffer);
  view.setUint16(0, token, true); view.setUint16(2, mint, true); view.setUint16(4, authority, true); view.setBigUint64(6, amount, true);
  return bytes;
}
