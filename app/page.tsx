import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { WizardProvider } from '@/components/wizard/wizard-context';
import { Wizard } from '@/components/wizard/wizard';

export default function Home() {
  return (
    <WizardProvider>
      <div className="relative flex min-h-dvh flex-col overflow-hidden">
        {/* Ambient background */}
        <div className="aurora" aria-hidden />
        <div className="pointer-events-none absolute inset-0 z-0 bg-grid opacity-40" aria-hidden />

        <SiteHeader />

        <main className="relative z-10 flex-1">
          <div className="container max-w-5xl py-10 sm:py-14">
            <Wizard />
          </div>
        </main>

        <SiteFooter />
      </div>
    </WizardProvider>
  );
}
