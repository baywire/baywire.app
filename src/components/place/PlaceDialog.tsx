"use client";

import { ExternalLink } from "lucide-react";
import type { Route } from "next";
import { PlaceDetailBody } from "@/components/place/PlaceDetailBody";
import { AddPlaceToPlanButton } from "@/components/plan/AddPlaceToPlanButton";
import { DialogShell, PillLink } from "@/design-system";

import type { AppPlace } from "@/lib/places/types";

export function PlaceDialog({
  place,
  open,
  onClose,
  initialInPlan = false,
}: {
  place: AppPlace;
  open: boolean;
  onClose: () => void;
  initialInPlan?: boolean;
}) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      panelMinHeight="sm:min-h-136"
      headerActions={
        <>
          <AddPlaceToPlanButton place={place} initialInPlan={initialInPlan} surface="onDark" />
          <PillLink href={`/place/${place.slug}` as Route}>
            <span>Page</span>
            <ExternalLink className="size-4 text-gulf-600" />
          </PillLink>
        </>
      }
    >
      <PlaceDetailBody place={place} imageLayout="dialog" />
    </DialogShell>
  );
}
