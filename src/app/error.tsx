"use client";

import { useEffect } from "react";

import { Button, Heading, Text } from "@/design-system";

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
      <Heading level="page">Something went sideways</Heading>
      <Text variant="muted" className="mt-2">
        We couldn&apos;t load events right now. Try again in a moment.
      </Text>
      <Button
        type="button"
        variant="primary"
        className="mt-6"
        onClick={reset}
      >
        Reload
      </Button>
    </div>
  );
}
