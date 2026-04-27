import { Suspense } from "react";

import { MainColumn, SectionSkeleton } from "@/components/home/MainColumn";
import { SiteFooter } from "@/components/SiteFooter";

import { isCityKey } from "@/lib/cities";
import { getWindow, type WindowKey } from "@/lib/time/window";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SearchParams {
  window?: string;
  city?: string;
  free?: string;
  view?: string;
  plan?: string;
  openPlan?: string;
}

export default async function HomePage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;
  const window: WindowKey =
    sp.window === "tonight" || sp.window === "week" ? sp.window : "weekend";
  const cityParam = sp.city && isCityKey(sp.city) ? sp.city : "all";
  const freeOnly = sp.free === "true";
  const defaultOpenFromQuery =
    sp.view === "plan" || sp.plan === "1" || sp.openPlan === "1";

  const windowMeta = getWindow(window);

  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col px-0 pb-12 sm:px-0 sm:pb-16">
        <Suspense fallback={<SectionSkeleton title={windowMeta.label} />}>
          <MainColumn
            window={window}
            city={cityParam}
            freeOnly={freeOnly}
            defaultOpenFromQuery={defaultOpenFromQuery}
          />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
