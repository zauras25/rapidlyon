import type { Metadata } from "next";
import { siteConfig } from "@/data/site";

export function createPageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const pageTitle = `${title} | ${siteConfig.brand}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: pageTitle,
      description,
      url: path,
      siteName: siteConfig.brand,
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
    },
  };
}
