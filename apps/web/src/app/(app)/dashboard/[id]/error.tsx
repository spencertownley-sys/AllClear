'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Button } from '@/components/ui/button';

export default function LocationError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner message="Couldn't load conditions for this location." onRetry={reset} />
      <Button variant="link" asChild>
        <Link href="/dashboard">Back to your Watch List</Link>
      </Button>
    </div>
  );
}
