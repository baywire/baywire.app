import Link from "next/link";
import type { Route } from "next";
import { prisma } from "@/lib/db/client";

export async function SiteFooter() {
  const sources = await prisma.source.findMany({
    where: { enabled: true },
    select: { label: true, baseUrl: true },
    orderBy: { label: "asc" },
  });

  return (
    <footer className="mt-20 border-t border-ink-100/60 bg-sand-50/60 py-8 text-center text-xs text-ink-500 dark:border-ink-700/60 dark:bg-ink-900/40 dark:text-ink-300">
      <div className="mx-auto max-w-6xl space-y-2 px-4 sm:px-6">
        <p>
          <span className="font-semibold text-ink-700 dark:text-sand-50">Baywire</span>{" "}
          — the live wire for Tampa Bay. Events aggregated and AI-curated from
          local and national sources.
        </p>
        <p className="mx-auto max-w-4xl leading-relaxed">
          Sources:{" "}
          {sources.map((source, idx) => (
            <span key={source.baseUrl}>
              <a
                href={source.baseUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted underline-offset-3 hover:text-gulf-600 dark:hover:text-gulf-200"
              >
                {source.label}
              </a>
              {idx < sources.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
        <p>
          All event details belong to their original sources. Please verify time
          and ticketing on the source page before attending.
        </p>
        <p>
          <Link
            href={"/about" as Route}
            className="underline decoration-dotted underline-offset-3 hover:text-gulf-600 dark:hover:text-gulf-200"
          >
            How we curate
          </Link>
        </p>
        <p className="text-[11px] text-ink-400 dark:text-ink-400">
          © {new Date().getFullYear()} Baywire
        </p>
      </div>
    </footer>
  );
}
