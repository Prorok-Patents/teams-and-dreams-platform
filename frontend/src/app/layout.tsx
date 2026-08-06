import type { Metadata } from 'next';
import { Inter, Playfair_Display, Space_Grotesk } from 'next/font/google';
import './globals.css';
import './map-explorer.css';
import { ToastProvider } from '@/components/ToastContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' });

export const metadata: Metadata = {
  title: 'Teams & Dreams | Event Explorer',
  description: 'Find premium sports events and hospitality packages.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${playfair.variable} ${spaceGrotesk.variable} bg-background text-foreground flex h-screen overflow-hidden`}>
        <ErrorBoundary name="RootLayout">
          <ToastProvider>
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
              {children}
            </main>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
