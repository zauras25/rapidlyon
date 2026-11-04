import { PublicShell } from '@/components/site/chrome';
import { LegalPage } from '@/components/site/public-pages';
export const metadata = { title: 'Privacy' };
export default function Page() { return <PublicShell><LegalPage kind="privacy"/></PublicShell>; }
