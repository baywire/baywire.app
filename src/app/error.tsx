"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-3xl font-semibold text-ink-900 dark:text-sand-50">
        Something went sideways
      </h1>
      <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
        We couldn&apos;t load events right now. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-sand-50 hover:bg-ink-700 dark:bg-sand-50 dark:text-ink-900"
      >
        Reload
      </button>
    </div>
  );
}
