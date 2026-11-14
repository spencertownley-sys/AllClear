import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SITE_URL } from '@/lib/site';
import { Toaster } from '@/components/ui/toaster';

// Self-hosted by next/font: downloaded at build time and served from our own origin, so page views
// don't send visitors' IP addresses to Google and the font doesn't block first paint (NW-09, NW-26).
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'NimbusWatch', template: '%s · NimbusWatch' },
  description:
    'One calm dashboard for weather, wildfire, earthquake, air-quality and official-alert status at the places you care about — every fact sourced from NWS, NASA FIRMS, USGS and AirNow.',
  applicationName: 'NimbusWatch',
  metadataBase: new URL(SITE_URL),
  manifest: '/manifest.webmanifest',
  // Icons and the share image come from the file conventions in this folder: icon.svg, favicon.ico,
  // apple-icon.png and opengraph-image.png (1200x630). Canonical URLs are set per public page.
  openGraph: {
    siteName: 'NimbusWatch',
    type: 'website',
    title: 'NimbusWatch',
    description: 'Weather, wildfire, earthquake, air-quality and official-alert status for the places you care about, every fact sourced.',
  },
  twitter: { card: 'summary_large_image' },
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
