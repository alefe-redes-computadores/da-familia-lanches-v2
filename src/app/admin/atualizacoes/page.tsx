import { AndroidUpdatesCenter } from '@/components/updates/AndroidUpdatesCenter';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Atualizações · DFL Admin', description: 'Versões certificadas do aplicativo Admin.' };
export default function AdminUpdatesPage() { return <AndroidUpdatesCenter app="admin" />; }
