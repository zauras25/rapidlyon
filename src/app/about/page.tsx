import { PublicShell } from '@/components/site/chrome';
import { AboutPage } from '@/components/site/public-pages';
export const metadata = { title: 'About' };
export default function Page() { return <PublicShell><AboutPage/></PublicShell>; }
