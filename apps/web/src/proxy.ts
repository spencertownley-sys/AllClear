import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/alerts', '/settings', '/onboarding'];

/**
 * Once NEXT_PUBLIC_SITE_URL names a custom domain, visits to the generated *.up.railway.app host get a
 * permanent redirect there (NW-21). Railway's own health checks use other hosts and are unaffected.
 */
function canonicalRedirect(request: NextRequest): NextResponse | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) return null;
  let target: URL;
  try {
    target = new URL(configured);
  } catch {
    return null;
  }
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0] ?? '';
  if (!host.endsWith('.up.railway.app') || host === target.hostname) return null;
  const url = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, target.origin);
  return NextResponse.redirect(url, 308);
}
const AUTH_PAGES = ['/login', '/signup'];

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and enforces the auth gates from
 * UI/UX Notes §4: Dashboard, Location Detail, Alerts, Settings and Onboarding require login;
 * Marketing and Map are public.
 */
export async function proxy(request: NextRequest) {
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });

  // Unconfigured environment (e.g. a preview without secrets): don't block the marketing site.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && startsWithAny(path, PROTECTED_PREFIXES)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(loginUrl);
  }

  if (user && startsWithAny(path, AUTH_PAGES)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets, the service worker, crawler files and image files.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|icons/|robots.txt|sitemap.xml|cookie-banner\\.(?:js|css)|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
