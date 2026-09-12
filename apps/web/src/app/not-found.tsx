import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/nav/app-shell';

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Logo />
      <h1 className="text-2xl font-semibold">That page doesn&apos;t exist</h1>
      <p className="max-w-sm text-sm text-slate-600">The link may be old, or the location may have been removed.</p>
      <Button asChild>
        <Link href="/dashboard">Go to your dashboard</Link>
      </Button>
    </div>
  );
}
