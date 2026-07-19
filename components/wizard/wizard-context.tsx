'use client';

import * as React from 'react';
import { readJSON, remove, writeJSON } from '@/lib/storage';
import type {
  DeployResult,
  NameResult,
  PasskeyInfo,
  ThruAccount,
} from '@/lib/thru/types';

export const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'account', title: 'Create Account' },
  { id: 'fund', title: 'Get Tokens' },
  { id: 'deploy', title: 'Deploy Program' },
  { id: 'name', title: 'Claim a Name' },
  { id: 'success', title: 'Done' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export interface WizardState {
  stepIndex: number;
  account: ThruAccount | null;
  keyBackedUp: boolean;
  passkey: PasskeyInfo | null;
  funded: boolean;
  deployment: DeployResult | null;
  name: NameResult | null;
  advanced: boolean;
}

const initialState: WizardState = {
  stepIndex: 0,
  account: null,
  keyBackedUp: false,
  passkey: null,
  funded: false,
  deployment: null,
  name: null,
  advanced: false,
};

type Action =
  | { type: 'goto'; index: number }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'setAccount'; account: ThruAccount }
  | { type: 'setBackedUp'; value: boolean }
  | { type: 'setPasskey'; passkey: PasskeyInfo | null }
  | { type: 'setFunded'; value: boolean }
  | { type: 'setDeployment'; deployment: DeployResult | null }
  | { type: 'setName'; name: NameResult | null }
  | { type: 'setAdvanced'; value: boolean }
  | { type: 'reset' }
  | { type: 'hydrate'; state: WizardState };

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'goto':
      return { ...state, stepIndex: clamp(action.index) };
    case 'next':
      return { ...state, stepIndex: clamp(state.stepIndex + 1) };
    case 'back':
      return { ...state, stepIndex: clamp(state.stepIndex - 1) };
    case 'setAccount':
      // A new account invalidates everything downstream — start it clean so a
      // freshly-generated wallet never inherits the old wallet's funded /
      // deployed / named state.
      return {
        ...state,
        account: action.account,
        keyBackedUp: false,
        passkey: null,
        funded: false,
        deployment: null,
        name: null,
      };
    case 'setBackedUp':
      return { ...state, keyBackedUp: action.value };
    case 'setPasskey':
      return { ...state, passkey: action.passkey };
    case 'setFunded':
      return { ...state, funded: action.value };
    case 'setDeployment':
      return { ...state, deployment: action.deployment };
    case 'setName':
      return { ...state, name: action.name };
    case 'setAdvanced':
      return { ...state, advanced: action.value };
    case 'reset':
      return { ...initialState };
    case 'hydrate':
      return action.state;
    default:
      return state;
  }
}

function clamp(i: number): number {
  return Math.max(0, Math.min(STEPS.length - 1, i));
}

interface WizardContextValue extends WizardState {
  dispatch: React.Dispatch<Action>;
  hydrated: boolean;
}

const WizardContext = React.createContext<WizardContextValue | null>(null);

const STORAGE_KEY = 'wizard-state';

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const [hydrated, setHydrated] = React.useState(false);

  // Load persisted state once on mount.
  React.useEffect(() => {
    const saved = readJSON<WizardState>(STORAGE_KEY);
    if (saved) {
      dispatch({ type: 'hydrate', state: { ...initialState, ...saved } });
    }
    setHydrated(true);
  }, []);

  // Persist on change (after hydration so we don't clobber saved state).
  React.useEffect(() => {
    if (!hydrated) return;
    if (state === initialState) return;
    writeJSON(STORAGE_KEY, state);
  }, [state, hydrated]);

  const value = React.useMemo<WizardContextValue>(
    () => ({ ...state, dispatch, hydrated }),
    [state, hydrated],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard() {
  const ctx = React.useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within <WizardProvider>');
  return ctx;
}

export function clearWizardStorage() {
  remove(STORAGE_KEY);
}
