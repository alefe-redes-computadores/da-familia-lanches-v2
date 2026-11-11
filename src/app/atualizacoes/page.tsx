import { AndroidUpdatesCenter } from '@/components/updates/AndroidUpdatesCenter';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Atualizações · Da Família Lanches', description: 'Versões certificadas do aplicativo Cliente.' };
export default function ClienteUpdatesPage() { return <AndroidUpdatesCenter app="cliente" />; }
