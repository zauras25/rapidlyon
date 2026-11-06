import { PublicShell } from '@/components/site/chrome';
import { DiscoveryResponse } from '@/components/forms/discovery-response';

export const metadata={
  title:'Discovery response',
  robots:{index:false,follow:false},
};

export default function Page(){
  return <PublicShell><DiscoveryResponse/></PublicShell>;
}
