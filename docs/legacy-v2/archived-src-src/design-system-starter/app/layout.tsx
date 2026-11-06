import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://rapidlyon.com'),
  title: { default: 'RapidlyOn — Ideas to impact', template: '%s | RapidlyOn' },
  description: 'Thoughtful product design, Next.js development, and SEO. From the first idea to an exceptional digital experience.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
