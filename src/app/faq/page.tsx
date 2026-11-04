import { PublicShell } from '@/components/site/chrome';
import { FaqPage } from '@/components/site/public-pages';
export const metadata = { title: 'FAQ' };
export default function Page() { return <PublicShell><FaqPage/></PublicShell>; }
