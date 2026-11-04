import { Suspense } from 'react';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PublicShell } from '@/components/site/chrome';
import { WorkDetail } from '@/components/site/public-pages';
import { getPublishedWorkProjects } from '@/lib/work-project-storage';
import { createPageMetadata } from '@/lib/metadata';

export async function generateMetadata({params}:{params:Promise<{slug:string}>}): Promise<Metadata> {
  await connection();
  const {slug} = await params;
  const project = (await getPublishedWorkProjects()).find((item) => item.slug === slug);
  if (!project) return { title: 'Project not found', robots: { index: false, follow: false } };
  return createPageMetadata(project.title, project.summary, `/work/${project.slug}`);
}

async function PublishedWorkDetail({params}:{params:Promise<{slug:string}>}) {
  await connection();
  const {slug} = await params;
  const project = (await getPublishedWorkProjects()).find(p => p.slug === slug);
  if (!project) notFound();
  return <WorkDetail project={project}/>;
}

export default function Page({params}:{params:Promise<{slug:string}>}) {
  return (
    <PublicShell>
      <Suspense fallback={<main className="shell section"><p>Loading case study...</p></main>}>
        <PublishedWorkDetail params={params} />
      </Suspense>
    </PublicShell>
  );
}
