import type { Metadata } from "next";
import { Suspense } from "react";
import { Manrope } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/ui/site-footer";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { siteConfig } from "@/data/site";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Rapidlyon | We turn ideas into digital products.",
    template: "%s | Rapidlyon",
  },
  description: siteConfig.description,
  openGraph: {
    title: "Rapidlyon | Digital product design and development",
    description: siteConfig.description,
    siteName: "Rapidlyon",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rapidlyon | Digital product design and development",
    description: siteConfig.description,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink">
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <Suspense fallback={null}>
          <SiteChrome header={<SiteHeader />} footer={<SiteFooter />}>
            {children}
          </SiteChrome>
        </Suspense>
      </body>
    </html>
  );
}
