import type { Metadata } from 'next';
import { DesignPreview } from './preview';

export const metadata: Metadata = { title: 'Design preview · Pulse' };

export default function Page() {
  return <DesignPreview />;
}
