import { PublicShell } from '@/components/site/chrome';
import { ServicesPage } from '@/components/site/public-pages';
export const metadata = { title: 'Services' };
export default function Page() { return <PublicShell><ServicesPage/></PublicShell>; }
