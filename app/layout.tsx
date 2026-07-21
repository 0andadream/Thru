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
  title: 'Thru Onboard — Get started on Thru in 60 seconds',
  description:
    'A friendly, guided wallet that helps anyone create a Thru account, get test tokens, launch and transfer a token, and claim a name. Testnet only.',
  keywords: ['Thru', 'blockchain', 'onboarding', 'wallet', 'testnet', 'alphanet', 'web3'],
  authors: [{ name: 'Thru Onboard' }],
  openGraph: {
    title: 'Thru Onboard — Get started on Thru in 60 seconds',
    description:
      'Create an account, get test tokens, launch and transfer a token, and claim a name on Thru.',
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
