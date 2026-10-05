"use client";

import Image from "next/image";
import type { CSSProperties } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes: string;
  priority?: boolean;
  quality?: number;
  style?: CSSProperties;
};

export function CatalogImage({
  src,
  alt,
  className,
  sizes,
  priority = false,
  quality = 72,
  style,
}: Props) {
  const source = String(src || "").trim();

  if (!source) return null;

  return (
    <Image
      src={source}
      alt={alt}
      className={className}
      width={720}
      height={540}
      sizes={sizes}
      quality={quality}
      priority={priority}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      style={{ width: "100%", height: "100%", objectFit: "cover", ...style }}
    />
  );
}
