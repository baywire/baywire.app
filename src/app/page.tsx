import { Suspense } from "react";

import { MainColumn, SectionSkeleton } from "@/components/home/MainColumn";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import { isCityKey } from "@/lib/cities";
import { getWindow, type WindowKey } from "@/lib/time/window";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SearchParams {
  window?: string;
  city?: string;
  free?: string;
}

export default async function HomePage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;
  const window: WindowKey =
    sp.window === "tonight" || sp.window === "week" ? sp.window : "weekend";
  const cityParam = sp.city && isCityKey(sp.city) ? sp.city : "all";
  const freeOnly = sp.free === "true";

  const windowMeta = getWindow(window);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-4 sm:px-6">
        <Suspense fallback={<SectionSkeleton title={windowMeta.label} />}>
          <MainColumn window={window} city={cityParam} freeOnly={freeOnly} />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
