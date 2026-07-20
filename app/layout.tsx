import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastProvider } from '@/components/ui/toast';
import { Analytics } from '@vercel/analytics/next';

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
  title: 'Thru Onboard — Get started on Thru in 60 seconds',
  description:
    'A friendly, guided wizard that helps anyone create a Thru account, get test tokens, deploy a program, and claim a name — all in a couple of minutes. Testnet only.',
  keywords: ['Thru', 'blockchain', 'onboarding', 'wallet', 'testnet', 'alphanet', 'web3'],
  authors: [{ name: 'Thru Onboard' }],
  openGraph: {
    title: 'Thru Onboard — Get started on Thru in 60 seconds',
    description:
      'Create an account, get test tokens, deploy a program, and claim a name on the Thru blockchain.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#cdd9d0' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1512' },
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
        <Analytics />
      </body>
    </html>
  );
}
