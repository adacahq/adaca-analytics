import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Adaca Analytics',
  description: 'Google Analytics 4 and BigQuery dashboards, self-hosted on Cloudflare Workers.',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
