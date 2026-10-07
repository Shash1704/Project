import type { Metadata } from 'next';
import { Welcome } from './welcome';

export const metadata: Metadata = { title: 'Welcome · Pulse' };

export default function Page() {
  return <Welcome />;
}
