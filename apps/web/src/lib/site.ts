/**
 * The public, canonical address of the site, used for robots.txt, the sitemap and metadataBase.
 * Set NEXT_PUBLIC_SITE_URL once a custom domain exists; until then it is the Railway hostname.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://web-production-41f16.up.railway.app').replace(/\/$/, '');

/** Pages that are public and worth indexing. Never list signed-in routes here. */
export const PUBLIC_ROUTES = ['/', '/map', '/signup', '/login', '/privacy', '/terms', '/cookies'] as const;

/** Signed-in and machine routes that search engines should not crawl. */
export const PRIVATE_PREFIXES = ['/dashboard', '/alerts', '/settings', '/onboarding', '/api/', '/auth/', '/unsubscribe'] as const;
