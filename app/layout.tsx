import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastProvider } from '@/components/ui/toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Thru — Betanet wallet',
  description:
    'Create or import a Thru wallet in the browser, then fund it, launch a token, and send it on Betanet. A key is made only when you click Create wallet.',
  keywords: ['Thru', 'blockchain', 'onboarding', 'wallet', 'testnet', 'betanet', 'web3'],
  authors: [{ name: 'Thru Onboard' }],
  openGraph: {
    title: 'Thru — Betanet wallet',
    description:
      'Create or import a Thru wallet, fund it, launch a token, and send it on Betanet.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#471417' },
    { media: '(prefers-color-scheme: dark)', color: '#21080d' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
