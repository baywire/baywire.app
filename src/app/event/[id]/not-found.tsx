import Link from "next/link";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-4xl font-semibold text-ink-900 dark:text-sand-50">
          Event not found
        </h1>
        <p className="mt-2 text-ink-500 dark:text-ink-300">
          This event may have wrapped up, or the link is wrong.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-sand-50 hover:bg-ink-700 dark:bg-sand-50 dark:text-ink-900"
        >
          Back to events
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
