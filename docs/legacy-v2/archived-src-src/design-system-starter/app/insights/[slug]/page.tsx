import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/site/chrome';
import { InsightDetail } from '@/components/site/public-pages';
import { insights } from '@/data/site';
import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';
export function generateStaticParams() { return insights.map(item => ({slug:item.slug})); }
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const post=insights.find(x=>x.slug===slug);return post?createPageMetadata(post.title,post.excerpt,`/insights/${slug}`):{robots:{index:false}};}
export default async function Page({params}:{params:Promise<{slug:string}>}) {
  const {slug} = await params;
  if (!insights.some(x=>x.slug===slug)) notFound();
  return <PublicShell><InsightDetail slug={slug}/></PublicShell>;
}
