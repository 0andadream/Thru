'use client';

import * as React from 'react';
import { useToast } from '@/components/ui/toast';
import { generateAccount } from '@/lib/thru/keys';
import { requestWalletImport } from '@/lib/thru/wallet-intent';
import { useWizard } from './wizard-context';

/** Create and import are explicit. Neither runs until the user clicks. */
export function useWalletGate() {
  const { dispatch } = useWizard();
  const { toast } = useToast();
  const [creating, setCreating] = React.useState(false);

  const createWallet = React.useCallback(async () => {
    setCreating(true);
    try {
      const next = await generateAccount();
      dispatch({ type: 'setAccount', account: next });
      dispatch({ type: 'setBackedUp', value: false });
      dispatch({ type: 'setPasskey', passkey: null });
      dispatch({ type: 'goto', index: 1 });
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not create a wallet',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
    }
  }, [dispatch, toast]);

  const importWallet = React.useCallback(() => {
    requestWalletImport();
    dispatch({ type: 'goto', index: 1 });
  }, [dispatch]);

  return { creating, createWallet, importWallet };
}
