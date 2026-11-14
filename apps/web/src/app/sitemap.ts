import type { MetadataRoute } from 'next';
import { PUBLIC_ROUTES, SITE_URL } from '@/lib/site';

/** Public pages only; signed-in routes never appear here. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    changeFrequency: path === '/map' ? 'hourly' : 'monthly',
    priority: path === '/' ? 1 : path === '/map' ? 0.8 : 0.4,
  }));
}
