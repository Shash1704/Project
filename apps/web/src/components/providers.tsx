'use client';

import { MotionConfig } from 'framer-motion';
import { motion } from '@pulse/ui/tokens';

/** App-wide client providers. `reducedMotion="user"` honours prefers-reduced-motion everywhere. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={motion.spring}>
      {children}
    </MotionConfig>
  );
}
