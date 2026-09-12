import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: { default: 'AllClear', template: '%s · AllClear' },
  description:
    'One calm dashboard for weather, wildfire, earthquake, air-quality and official-alert status at the places you care about — every fact sourced from NWS, NASA FIRMS, USGS and AirNow.',
  applicationName: 'AllClear',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
  appleWebApp: { capable: true, title: 'AllClear', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#0f6b66',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Root layout applies to every route, so the pages-router "single page" caveat doesn't apply. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
