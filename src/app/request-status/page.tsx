import { PublicShell } from '@/components/site/chrome';
import { RequestStatus } from '@/components/forms/request-status';
export const metadata={title:'Request status',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Page(){return <PublicShell><main><RequestStatus/></main></PublicShell>}
