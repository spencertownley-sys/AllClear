import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Sign up' };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Create your account</h1>
      <p className="mb-6 text-sm text-slate-500">Free. You&apos;ll add your first location right after.</p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AuthForm mode="signup" />
      </Suspense>
    </>
  );
}
