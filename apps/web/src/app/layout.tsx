import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

// Self-hosted by next/font: downloaded at build time and served from our own origin, so page views
// don't send visitors' IP addresses to Google and the font doesn't block first paint (NW-09, NW-26).
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'NimbusWatch', template: '%s · NimbusWatch' },
  description:
    'One calm dashboard for weather, wildfire, earthquake, air-quality and official-alert status at the places you care about — every fact sourced from NWS, NASA FIRMS, USGS and AirNow.',
  applicationName: 'NimbusWatch',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
  appleWebApp: { capable: true, title: 'NimbusWatch', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#0f6b66',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
