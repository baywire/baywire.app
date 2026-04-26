"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import Link from "next/link";

import { AddToPlanButton } from "@/components/plan/AddToPlanButton";
import { EventDetailBody } from "@/components/event/EventDetailBody";

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
    setMounted(true);
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
          "relative z-101 flex w-full max-w-lg max-h-dvh flex-col overflow-hidden",
          "bg-sand-50 shadow-2xl sm:max-h-[min(100dvh,40rem)] sm:max-w-xl sm:rounded-2xl dark:bg-ink-900",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-ink-800 bg-ink-900 px-3 py-2.5 sm:items-center sm:gap-3 sm:px-4 sm:py-3">
          <h2
            id={titleId}
            className="line-clamp-2 min-w-0 flex-1 pr-1 text-left font-display text-sm font-semibold leading-snug text-sand-50 sm:text-base"
          >
            {event.title}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <AddToPlanButton
              eventId={event.id}
              initialInPlan={initialInPlan}
              surface="onDark"
            />
            <Link
              href={`/event/${event.id}`}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-sand-200/90 bg-sand-50 px-2.5 text-xs font-semibold text-gulf-700 shadow-sm transition hover:border-sand-100 hover:bg-white sm:px-3 sm:text-sm"
            >
              <span className="max-sm:sr-only">Page</span>
              <ExternalLink className="size-3.5 text-gulf-600 sm:size-4" />
            </Link>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-sand-200 transition hover:bg-white/10 hover:text-sand-50"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <EventDetailBody event={event} hideTitle imageLayout="dialog" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
