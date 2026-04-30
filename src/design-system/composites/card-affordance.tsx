import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { cardAffordanceClass } from "../variants";

export function CardAffordance({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn(cardAffordanceClass, className)}>
      <ArrowUpRight className="size-4" />
    </span>
  );
}
