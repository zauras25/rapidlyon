import { Suspense } from 'react';
import { AdminStudio } from '@/components/console/admin-studio';

export const metadata = {
  title: 'RapidlyOn — Studio Administration',
  robots: { index: false, follow: false },
};

export default function AdminRoute() {
  return <Suspense fallback={<main aria-busy="true">Preparing studio workspace…</main>}><AdminStudio /></Suspense>;
}
