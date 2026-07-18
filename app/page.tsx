import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { WizardProvider } from '@/components/wizard/wizard-context';
import { Wizard } from '@/components/wizard/wizard';

export default function Home() {
  return (
    <WizardProvider>
      <div className="relative flex min-h-dvh flex-col">
        {/* Engineering grid on the pale page */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-grid opacity-70" aria-hidden />

        <SiteHeader />

        <main className="relative z-10 flex-1">
          <div className="container max-w-5xl py-8 sm:py-12">
            {/* White work panel that sits on the green page, like the site's content column */}
            <div className="rounded-sm border border-foreground bg-card p-5 shadow-hard sm:p-8">
              <Wizard />
            </div>
          </div>
        </main>

        <SiteFooter />
      </div>
    </WizardProvider>
  );
}
