'use client';

import * as React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Stepper } from './stepper';
import { AdvancedToggle } from './advanced-toggle';
import { STEPS, useWizard } from './wizard-context';
import { WelcomeStep } from './steps/welcome-step';
import { CreateAccountStep } from './steps/create-account-step';
import { FundStep } from './steps/fund-step';
import { DeployStep } from './steps/deploy-step';
import { SuccessStep } from './steps/success-step';
import { Spinner } from '@/components/ui/spinner';

export function Wizard() {
  const { stepIndex, hydrated } = useWizard();

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  const stepId = STEPS[stepIndex].id;
  const isWelcome = stepId === 'welcome';
  const isSuccess = stepId === 'success';

  return (
    <div className="space-y-8">
      {!isWelcome && !isSuccess && (
        <div className="space-y-4">
          <Stepper />
          <AdvancedToggle />
        </div>
      )}

      <AnimatePresence mode="wait">
        <React.Fragment key={stepId}>
          {stepId === 'welcome' && <WelcomeStep />}
          {stepId === 'account' && <CreateAccountStep />}
          {stepId === 'fund' && <FundStep />}
          {stepId === 'deploy' && <DeployStep />}
          {stepId === 'success' && <SuccessStep />}
        </React.Fragment>
      </AnimatePresence>
    </div>
  );
}
