"use client";

import { useEffect, useMemo, useState } from "react";
import {
  mergeCategories,
  normalizeRemoteCategoryRecord,
  type CatalogCategory,
} from "@/lib/catalogCategories";
import {
  readPublicCatalog,
  subscribePublicCatalog,
} from "@/lib/publicCatalogClient";

const objectData = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function useCatalogCategories() {
  const [snapshot, setSnapshot] = useState(readPublicCatalog);

  useEffect(() => subscribePublicCatalog(setSnapshot), []);

  const remote = useMemo(
    () =>
      (Array.isArray(snapshot.payload?.categories)
        ? snapshot.payload.categories
        : []
      )
        .map((item) =>
          normalizeRemoteCategoryRecord(
            String(item?.id ?? ""),
            objectData(item?.data),
          ),
        )
        .filter((item): item is CatalogCategory => Boolean(item)),
    [snapshot.payload],
  );

  const categories = useMemo(() => mergeCategories(remote), [remote]);
  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );

  return {
    categories,
    activeCategories,
    loading: !snapshot.ready,
    source: remote.length ? ("remote" as const) : ("fallback" as const),
    remoteCategories: remote.length,
  };
}
