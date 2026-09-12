import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Welcome back</h1>
      <p className="mb-6 text-sm text-slate-500">Log in to see your Watch List.</p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}
