import type { Metadata, Viewport } from 'next';
import { Lexend } from 'next/font/google';
import { colors } from '@pulse/ui/tokens';
import { Providers } from '@/components/providers';
import './globals.css';

const lexend = Lexend({
  variable: '--font-lexend',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pulse',
  description:
    'Real-time chat with an AI layer that helps you catch up, search and understand busy chats.',
};

export const viewport: Viewport = {
  themeColor: colors.ink,
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${lexend.variable} antialiased`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
