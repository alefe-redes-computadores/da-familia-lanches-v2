import { notFound } from 'next/navigation';
import { TrackingExperience } from '@/components/tracking/TrackingExperience';
export const dynamic = 'force-dynamic';
export const metadata = {title:'Acompanhar pedido | Da Família Lanches',robots:{index:false,follow:false}};
export default function TrackingPage(){
  if (process.env.DFL_SITE_TRACKING_ENABLED !== '1') notFound();
  return <TrackingExperience/>;
}
