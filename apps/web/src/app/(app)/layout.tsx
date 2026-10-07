import { Suspense } from 'react';
import { AppFrame, Splash } from './frame';

/** usePathname/useParams read request data, so the frame renders inside a Suspense boundary. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Splash />}>
      <AppFrame>{children}</AppFrame>
    </Suspense>
  );
}
