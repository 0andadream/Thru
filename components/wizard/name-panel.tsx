'use client';

import * as React from 'react';
import { Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useWizard } from './wizard-context';
import { AddressRow } from './step-parts';
import { accountUrl } from '@/lib/thru/explorer';
import { isValidLabel, suggestRoots } from '@/lib/thru/nameservice';
import { registerNameOnChain } from '@/lib/thru/nameservice-onchain';

export function NamePanel() {
  const { account, name, dispatch } = useWizard();
  const { toast } = useToast();
  const suggestions = React.useMemo(() => (account ? suggestRoots(account.address) : []), [account]);
  const [root, setRoot] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!root && suggestions[0]) setRoot(suggestions[0]);
    if (!label && suggestions[1]) setLabel(suggestions[1]);
  }, [label, root, suggestions]);

  if (!account) return null;

  const ready = isValidLabel(root) && isValidLabel(label) && root.toLowerCase() !== label.toLowerCase();

  async function register() {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const created = await registerNameOnChain(account, root, label);
      dispatch({
        type: 'setName',
        name: {
          root: root.toLowerCase(),
          subdomain: label.toLowerCase(),
          fullName: `${label.toLowerCase()}.${root.toLowerCase()}`,
          rootAddress: created.registrar,
          subdomainAddress: created.domain,
          records: {},
          onChain: true,
        },
      });
      toast({ variant: 'success', title: 'Name registered', description: `${label.toLowerCase()}.${root.toLowerCase()}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast({ variant: 'error', title: 'Name registration failed', description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <Tag className="size-4 text-primary" /> Name service
          </p>
          <p className="text-xs text-muted-foreground">
            Create a root and register a name under it. The paid .thru registry is not open on this network yet.
          </p>
        </div>
        {name?.onChain ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{name.fullName}</p>
            <AddressRow label="Root" value={name.rootAddress} href={accountUrl(name.rootAddress)} />
            <AddressRow label="Name" value={name.subdomainAddress} href={accountUrl(name.subdomainAddress)} />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name-root">Root</Label>
                <Input id="name-root" value={root} onChange={(event) => setRoot(event.target.value.toLowerCase())} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name-label">Name</Label>
                <Input id="name-label" value={label} onChange={(event) => setLabel(event.target.value.toLowerCase())} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {ready ? `This will register ${label}.${root}.` : 'Use 1–32 letters or numbers. The name and root must differ.'}
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={register} disabled={!ready || busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Tag />} Register name
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
