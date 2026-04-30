import Link from "next/link";

import { Heading, Text, buttonClasses } from "@/design-system";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 text-center">
        <Heading level="page" className="text-4xl">Event not found</Heading>
        <Text variant="muted" className="mt-2">
          This event may have wrapped up, or the link is wrong.
        </Text>
        <Link
          href="/"
          className={buttonClasses({ variant: "primary", size: "md", className: "mt-6" })}
        >
          Back to events
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
