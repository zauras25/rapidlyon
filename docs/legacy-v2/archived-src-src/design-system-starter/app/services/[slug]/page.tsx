import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/site/chrome';
import { ServiceDetail } from '@/components/site/public-pages';
import { services, legacyServiceRedirects } from '@/data/site';
import { permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';
export function generateStaticParams() { return services.map(item => ({slug:item.slug})); }
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const service=services.find(x=>x.slug===slug);return service?createPageMetadata(service.title,service.description,`/services/${slug}`):{robots:{index:false}};}
export default async function Page({params}:{params:Promise<{slug:string}>}) {
  const {slug} = await params;
  if (legacyServiceRedirects[slug]) permanentRedirect(`/services/${legacyServiceRedirects[slug]}`);
  if (!services.some(x=>x.slug===slug)) notFound();
  return <PublicShell><ServiceDetail slug={slug}/></PublicShell>;
}
