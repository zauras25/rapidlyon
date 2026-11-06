import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DM_Sans, Outfit } from 'next/font/google';
import '../styles/globals.css';

// Self-hosted via next/font: no render-blocking @import, no third-party request
// at runtime, automatic size-adjusted fallback (prevents layout shift).
// Both families are variable fonts, so the intermediate weights used in the
// stylesheet (450, 550, 650, 750) resolve correctly.
const outfit = Outfit({ subsets: ['latin'], display: 'swap', variable: '--font-outfit' });
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm-sans' });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rapidlyon.com';
const description =
  'Thoughtful product design, Next.js development, and SEO. From the first idea to an exceptional digital experience.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'RapidlyOn — Ideas to impact', template: '%s | RapidlyOn' },
  description,
  applicationName: 'RapidlyOn',
  openGraph: {
    type: 'website',
    siteName: 'RapidlyOn',
    title: 'RapidlyOn — Ideas to impact',
    description,
  },
  twitter: { card: 'summary', title: 'RapidlyOn — Ideas to impact', description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#fafaf6',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
