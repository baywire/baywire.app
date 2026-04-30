"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

import { cn } from "@/lib/utils";

interface FallbackImageProps extends Omit<ImageProps, "onError"> {
  fallback: React.ReactNode;
}

export function FallbackImage({ fallback, className, ...props }: FallbackImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) return <>{fallback}</>;

  return (
    <Image
      {...props}
      className={cn(className)}
      onError={() => setFailed(true)}
    />
  );
}
