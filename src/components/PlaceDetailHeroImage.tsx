"use client";

import Image from "next/image";
import { useState } from "react";

export function PlaceDetailHeroImage({
  imageUrl,
  name,
  categoryLabel,
}: {
  imageUrl: string | null;
  name: string;
  categoryLabel: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imageUrl || imgFailed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-card bg-linear-to-br from-gulf-100 via-sand-100 to-sunset-100 font-display text-3xl text-ink-500">
        {categoryLabel}
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-card bg-sand-100">
      <Image
        src={imageUrl}
        alt={name}
        fill
        sizes="(min-width: 896px) 896px, 100vw"
        className="object-cover"
        priority
        unoptimized
        onError={() => setImgFailed(true)}
      />
    </div>
  );
}
