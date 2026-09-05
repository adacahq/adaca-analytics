import type { Metadata } from 'next';
import './globals.css';
import Toaster from '@/components/ui/Toaster';
import CanvasMotion from '@/components/ui/CanvasMotion';
import VizTip from '@/components/ui/VizTip';

export const metadata: Metadata = {
  title: 'Adaca Analytics',
  description: 'Google Analytics 4 and BigQuery dashboards, self-hosted on Cloudflare Workers.',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png' }],
  },
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

// The motion gate, before paint: no JS or reduced motion ⇒ the finished state.
// Every animation rule in globals.css is prefixed `.canvas-motion `, so without
// this class elements render complete rather than hidden.
const MOTION_GATE = `if(window.matchMedia&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('canvas-motion');}`;

// The theme gate, before paint: the operator's stored choice (light default).
const THEME_GATE = `try{if(localStorage.getItem('analytics-theme')==='dark'){document.documentElement.dataset.theme='dark';}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the head script stamps .canvas-motion and
    // data-theme — both client-only knowledge React keeps.
    // No `h-full` on either element: globals.css sets `body { overflow-x:
    // hidden; min-height: 100svh }` and a 100% height would stop the page
    // scrolling once content exceeds one screen.
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_GATE + THEME_GATE }} />
      </head>
      <body>
        {children}
        <CanvasMotion />
        <VizTip />
        <Toaster />
      </body>
    </html>
  );
}
