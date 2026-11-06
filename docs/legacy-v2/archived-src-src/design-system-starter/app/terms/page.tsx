import { PublicShell } from '@/components/site/chrome';
import { LegalPage } from '@/components/site/public-pages';
export const metadata = { title: 'Terms' };
export default function Page() { return <PublicShell><LegalPage kind="terms"/></PublicShell>; }
