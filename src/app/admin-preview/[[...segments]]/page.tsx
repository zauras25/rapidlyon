import { Suspense } from 'react';
import { AdminV1Workspace } from '@/components/admin-v1/admin-workspace';

export const metadata = {
  title: 'Admin CMS V1 preview | RapidlyOn',
  robots: { index: false, follow: false },
};

export default function AdminPreviewPage() {
  return <Suspense fallback={<main role="status" style={{padding:40}}>Preparing the secure workspace…</main>}><AdminV1Workspace/></Suspense>;
}
