import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

/** Origin of a configured URL (e.g. a custom Supabase domain or the Sentry ingest host), if any. */
function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const sentryOrigin = sentryDsn ? originOf(sentryDsn.replace(/\/\/[^@/]*@/, '//')) : null;
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy (NW-08). Hazard data is read through our own /api, so the only outside
 * hosts are the public map tiles and overlays the browser loads directly (CLAUDE.md rule 1), the
 * Supabase API for auth, and Sentry when a DSN is set. Keep this list in step with
 * components/map/basemaps.ts, components/map/radar.ts and the privacy and cookie pages.
 * Next.js injects inline bootstrap scripts, hence 'unsafe-inline'; dev mode also needs 'unsafe-eval'.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  [
    "img-src 'self' data: blob:",
    'https://tile.openstreetmap.org',
    'https://basemap.nationalmap.gov',
    'https://*.rainviewer.com',
    'https://mesonet.agron.iastate.edu',
    'https://coastwatch.pfeg.noaa.gov',
  ].join(' '),
  [
    "connect-src 'self'",
    'https://*.supabase.co',
    supabaseOrigin,
    'https://api.rainviewer.com',
    'https://*.ingest.sentry.io',
    'https://*.ingest.us.sentry.io',
    sentryOrigin,
    isDev ? 'ws:' : null,
  ]
    .filter(Boolean)
    .join(' '),
  "font-src 'self' https://fonts.gstatic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nimbuswatch/shared'],
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // The service worker must be served from the origin root with no caching surprises.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ];
  },
};

// Source-map upload only runs when a Sentry auth token is present (CI/production).
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;
