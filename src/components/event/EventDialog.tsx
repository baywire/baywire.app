"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import type { Route } from "next";
import { AddToPlanButton } from "@/components/plan/AddToPlanButton";
import { EventDetailBody } from "@/components/event/EventDetailBody";
import { IconButton, PillLink } from "@/components/ui";

import type { Event } from "@/generated/prisma/client";

import { cn } from "@/lib/utils";

export function EventDialog({
  event,
  open,
  onClose,
  initialInPlan,
}: {
  event: Event;
  open: boolean;
  onClose: () => void;
  initialInPlan: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const prevActive = useRef<HTMLElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    prevActive.current = (document.activeElement as HTMLElement) ?? null;
    const t = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      prevActive.current?.focus();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  if (!mounted || typeof document === "undefined" || !open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-end justify-center p-3 pb-5 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px] dark:bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-101 flex w-full max-w-lg min-h-[50dvh] max-h-dvh flex-col overflow-hidden",
          "bg-sand-50 shadow-2xl sm:min-h-[34rem] sm:max-h-[min(100dvh,56rem)] sm:max-w-xl sm:rounded-2xl dark:bg-ink-900",
        )}
      >
        <div className="flex shrink-0 items-center justify-end gap-1.5 border-b border-ink-800 bg-ink-900 px-3 py-2.5 sm:gap-2 sm:px-4 sm:py-3">
          <AddToPlanButton
            event={event}
            initialInPlan={initialInPlan}
            surface="onDark"
          />
          <PillLink href={`/event/${event.id}` as Route}>
            <span className="max-sm:sr-only">Page</span>
            <ExternalLink className="size-3.5 text-gulf-600 sm:size-4" />
          </PillLink>
          <IconButton
            ref={closeRef}
            type="button"
            size="sm"
            surface="onDark"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <EventDetailBody
            event={event}
            imageLayout="dialog"
            titleId={titleId}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
