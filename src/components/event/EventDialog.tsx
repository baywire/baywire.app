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
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
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
        className={cn(
          "relative z-[101] flex max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-sand-50 shadow-2xl dark:bg-ink-900",
          "sm:max-h-[min(100dvh,48rem)] sm:rounded-2xl",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ink-200/80 bg-sand-50/95 px-3 py-2 backdrop-blur sm:px-4 dark:border-ink-700/80 dark:bg-ink-900/95">
          <h2
            id={titleId}
            className="min-w-0 truncate pr-2 font-display text-sm font-semibold text-ink-900 sm:text-base dark:text-sand-50"
          >
            {event.title}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <AddToPlanButton eventId={event.id} initialInPlan={initialInPlan} />
            <Link
              href={`/event/${event.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-800 hover:border-ink-300 dark:border-ink-600 dark:bg-ink-800/80 dark:text-sand-100 dark:hover:border-ink-500 sm:px-3 sm:text-sm"
            >
              <span className="max-sm:sr-only">Page</span>
              <ExternalLink className="size-3.5 sm:size-4" />
            </Link>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800 dark:hover:text-sand-50"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="p-0 sm:p-0">
            <EventDetailBody event={event} hideTitle />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
