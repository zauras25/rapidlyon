import { PublicShell } from '@/components/site/chrome';
import { WorkPage } from '@/components/site/public-pages';
import { getPublishedWorkProjects } from '@/lib/work-project-storage';
export const metadata = { title: 'Work' };
export default async function Page() { const projects = await getPublishedWorkProjects(); return <PublicShell><WorkPage projects={projects}/></PublicShell>; }
