import { Suspense } from 'react';
import { connection } from 'next/server';
import { PublicShell } from '@/components/site/chrome';
import { WorkPage } from '@/components/site/public-pages';
import { getPublishedWorkProjects } from '@/lib/work-project-storage';
export const metadata = { title: 'Work' };

async function PublishedWorkPage() {
  await connection();
  const projects = await getPublishedWorkProjects();
  return <WorkPage projects={projects} />;
}

export default function Page() {
  return (
    <PublicShell>
      <Suspense fallback={<WorkPage projects={[]} />}>
        <PublishedWorkPage />
      </Suspense>
    </PublicShell>
  );
}
