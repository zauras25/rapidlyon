import { PublicShell } from '@/components/site/chrome';
import { InsightsPage } from '@/components/site/public-pages';
export const metadata = { title: 'Insights' };
export default function Page() { return <PublicShell><InsightsPage/></PublicShell>; }
