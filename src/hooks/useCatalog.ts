"use client";

import { useEffect, useMemo, useState } from "react";
import {
  mergeAddons,
  mergeAllAddons,
  mergeProducts,
  normalizeRemoteAddonRecord,
  normalizeRemoteProductRecord,
  type CatalogSource,
} from "@/lib/catalog";
import {
  readPublicCatalog,
  reloadPublicCatalog,
  subscribePublicCatalog,
} from "@/lib/publicCatalogClient";
import type { Product } from "@/data/products";
import type { Addon } from "@/data/addons";

const recordData = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const reloadCatalog = reloadPublicCatalog;

export function useCatalog() {
  const [snapshot, setSnapshot] = useState(readPublicCatalog);

  useEffect(() => subscribePublicCatalog(setSnapshot), []);

  const records = snapshot.payload;
  const remoteProducts = useMemo(
    () =>
      (Array.isArray(records?.products) ? records.products : [])
        .map((item) =>
          normalizeRemoteProductRecord(
            String(item?.id ?? ""),
            recordData(item?.data),
          ),
        )
        .filter((item): item is Product => Boolean(item)),
    [records],
  );

  const remoteAddons = useMemo(
    () =>
      (Array.isArray(records?.addons) ? records.addons : [])
        .map((item) =>
          normalizeRemoteAddonRecord(
            String(item?.id ?? ""),
            recordData(item?.data),
          ),
        )
        .filter((item): item is Addon => Boolean(item)),
    [records],
  );

  const products = useMemo(() => mergeProducts(remoteProducts), [remoteProducts]);
  const allAddons = useMemo(() => mergeAllAddons(remoteAddons), [remoteAddons]);
  const addons = useMemo(() => mergeAddons(remoteAddons), [remoteAddons]);
  const source: CatalogSource =
    remoteProducts.length || remoteAddons.length ? "hybrid" : "fallback";

  return {
    products,
    addons,
    allAddons,
    source,
    loading: !snapshot.ready,
    error: snapshot.error,
    reload: reloadCatalog,
    remoteProducts: remoteProducts.length,
    remoteAddons: remoteAddons.length,
  };
}
