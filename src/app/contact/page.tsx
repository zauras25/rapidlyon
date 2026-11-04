import { PublicShell } from '@/components/site/chrome';
import { ContactPage } from '@/components/site/public-pages';
export const metadata = { title: 'Contact' };
export default function Page() { return <PublicShell><ContactPage/></PublicShell>; }
