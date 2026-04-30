"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import type { Route } from "next";
import { PlaceDetailBody } from "@/components/place/PlaceDetailBody";
import { IconButton, PillLink } from "@/components/ui";

import type { AppPlace } from "@/lib/places/types";

import { cn } from "@/lib/utils";

export function PlaceDialog({
  place,
  open,
  onClose,
}: {
  place: AppPlace;
  open: boolean;
  onClose: () => void;
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
      className="fixed inset-0 z-100 flex items-end justify-center sm:items-center sm:p-4"
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
          "bg-sand-50 shadow-2xl sm:min-h-136 sm:max-h-[min(100dvh,56rem)] sm:max-w-xl sm:rounded-2xl dark:bg-ink-900",
        )}
      >
        <div
          className="flex shrink-0 items-center justify-end gap-2 border-b border-ink-800 bg-ink-900 px-3 py-2.5 sm:px-4 sm:py-3"
          style={{
            paddingTop: "max(env(safe-area-inset-top, 0px), 0.625rem)",
          }}
        >
          <PillLink href={`/place/${place.slug}` as Route}>
            <span>Page</span>
            <ExternalLink className="size-4 text-gulf-600" />
          </PillLink>
          <IconButton
            ref={closeRef}
            type="button"
            surface="onDark"
            onClick={onClose}
            aria-label="Close"
            className="size-10 sm:size-9"
          >
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <PlaceDetailBody
            place={place}
            imageLayout="dialog"
            titleId={titleId}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
