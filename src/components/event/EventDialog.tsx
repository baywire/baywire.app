"use client";

import { ExternalLink } from "lucide-react";
import type { Route } from "next";
import { AddToPlanButton } from "@/components/plan/AddToPlanButton";
import { EventDetailBody } from "@/components/event/EventDetailBody";
import { DialogShell, PillLink } from "@/design-system";

import type { AppEvent } from "@/lib/events/types";

export function EventDialog({
  event,
  open,
  onClose,
  initialInPlan,
}: {
  event: AppEvent;
  open: boolean;
  onClose: () => void;
  initialInPlan: boolean;
}) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      headerActions={
        <>
          <AddToPlanButton event={event} initialInPlan={initialInPlan} surface="onDark" />
          <PillLink href={`/event/${event.id}` as Route}>
            <span>Page</span>
            <ExternalLink className="size-4 text-gulf-600" />
          </PillLink>
        </>
      }
    >
      <EventDetailBody event={event} imageLayout="dialog" />
    </DialogShell>
  );
}
