'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
        <h1>Something went wrong.</h1>
        <p>Please try again.</p>
        <button type="button" onClick={reset} style={{ minHeight: 44, padding: '0 20px' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
