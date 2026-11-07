import { PublicShell } from '@/components/site/chrome';
import { DiscoveryPage } from '@/components/site/public-pages';
export const metadata = { title: 'Discovery' };
export default function Page() { return <PublicShell><DiscoveryPage/></PublicShell>; }
