"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import { isDeploymentSkewError, recoverFromDeploymentSkew } from "@/lib/deployment-skew";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    // A stale tab that posts a Server Action the current build no longer knows
    // is not a real fault. Reload to the fresh bundle instead of crashing.
    if (isDeploymentSkewError(error) && recoverFromDeploymentSkew()) {
      setRecovering(true);
      return;
    }

    Sentry.captureException(error);
  }, [error]);

  if (recovering) {
    return (
      <html>
        <body>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#666',
          }}>
            <p>Loading the latest version…</p>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Something went wrong!
          </h1>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            We've been notified of this issue and are working to fix it.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
