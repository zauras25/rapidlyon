import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PublicShell } from '@/components/site/chrome';
import { WorkDetail } from '@/components/site/public-pages';
import { featuredProjects } from '@/data/site';
import { getPublishedWorkProjects } from '@/lib/work-project-storage';
import { createPageMetadata } from '@/lib/metadata';

// Built-in projects may be generated at build time; published CMS slugs remain dynamic.
export function generateStaticParams() { return featuredProjects.filter(p => p.status === 'published').map(item => ({slug:item.slug})); }
export async function generateMetadata({params}:{params:Promise<{slug:string}>}): Promise<Metadata> {
  const {slug} = await params;
  const project = (await getPublishedWorkProjects()).find(p => p.slug === slug);
  if (!project) return { title: 'Project not found', robots: { index: false, follow: false } };
  return createPageMetadata(project.title, project.summary, `/work/${project.slug}`);
}
export default async function Page({params}:{params:Promise<{slug:string}>}) {
  const {slug} = await params;
  const project = (await getPublishedWorkProjects()).find(p => p.slug === slug);
  if (!project) notFound();
  return <PublicShell><WorkDetail project={project}/></PublicShell>;
}
