import { PublicShell } from '@/components/site/chrome';
import { ProcessPage } from '@/components/site/public-pages';
export const metadata = { title: 'Process' };
export default function Page() { return <PublicShell><ProcessPage/></PublicShell>; }
