'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LayoutDashboard, Map, Settings, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ShellUser {
  email: string | null;
}

interface AppShellProps {
  user: ShellUser | null;
  children: React.ReactNode;
}

const TABS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, auth: true },
  { href: '/map', label: 'Map', icon: Map, auth: false },
  { href: '/alerts', label: 'Alerts', icon: Bell, auth: true },
  { href: '/settings', label: 'Settings', icon: Settings, auth: true },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('inline-flex items-center gap-2 font-semibold text-slate-900', className)}>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-control bg-primary text-primary-foreground">
        <ShieldCheck className="h-5 w-5" aria-hidden />
      </span>
      <span>AllClear</span>
    </Link>
  );
}

/**
 * Bottom tab bar on mobile, top nav on desktop (UI/UX Notes §4). Four destinations:
 * Dashboard / Map / Alerts / Settings. Logged-out visitors get Log in / Sign up instead.
 */
export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => !t.auth || user);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {tabs.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-control px-3 text-sm font-medium transition-colors',
                  isActive(pathname, href) ? 'bg-primary-soft text-primary' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden max-w-[200px] truncate text-sm text-slate-500 md:inline" title={user.email ?? ''}>
                  {user.email}
                </span>
                <form action="/auth/signout" method="post">
                  <Button variant="ghost" size="sm" type="submit">
                    Log out
                  </Button>
                </form>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Log in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/signup">Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-5 md:pb-10">{children}</main>

      {user ? (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="grid grid-cols-4">
            {tabs.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium',
                      active ? 'text-primary' : 'text-slate-500',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
