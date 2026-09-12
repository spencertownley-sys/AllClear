'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32, textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>Please reload the page.</p>
        <button type="button" onClick={() => reset()} style={{ padding: '8px 16px' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
