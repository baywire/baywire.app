import type { Route } from "next";
import Link from "next/link";

import { Heading, Text, buttonClasses } from "@/design-system";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 text-center">
        <Heading level="page" className="text-4xl">Place not found</Heading>
        <Text variant="muted" className="mt-2">
          This place may have been removed, or the link is wrong.
        </Text>
        <Link
          href={"/places" as Route}
          className={buttonClasses({ variant: "primary", size: "md", className: "mt-6" })}
        >
          Back to places
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
