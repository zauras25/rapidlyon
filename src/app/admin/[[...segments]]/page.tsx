import { Suspense } from 'react';
import { AdminConsole } from '@/components/console/admin-console';

export const metadata = {
  title: 'Studio administration',
  robots: { index: false, follow: false },
};

function AdminLoading() {
  return (
    <main className="auth-layout" aria-busy="true">
      <div className="form-panel">
        <p className="eyebrow">RapidlyOn Studio</p>
        <h1>Preparing your workspace…</h1>
        <p className="lead">Loading the admin interface.</p>
      </div>
    </main>
  );
}

export default function AdminRoute() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminConsole />
    </Suspense>
  );
}
