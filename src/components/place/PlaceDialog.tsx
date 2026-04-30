"use client";

import { ExternalLink } from "lucide-react";
import type { Route } from "next";
import { PlaceDetailBody } from "@/components/place/PlaceDetailBody";
import { DialogShell, PillLink } from "@/design-system";

import type { AppPlace } from "@/lib/places/types";

export function PlaceDialog({
  place,
  open,
  onClose,
}: {
  place: AppPlace;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      panelMinHeight="sm:min-h-136"
      headerActions={
        <PillLink href={`/place/${place.slug}` as Route}>
          <span>Page</span>
          <ExternalLink className="size-4 text-gulf-600" />
        </PillLink>
      }
    >
      <PlaceDetailBody place={place} imageLayout="dialog" />
    </DialogShell>
  );
}
