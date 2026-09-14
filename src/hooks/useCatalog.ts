"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  CATALOG_ADDONS_COLLECTION,
  CATALOG_PRODUCTS_COLLECTION,
  mergeAddons,
  mergeAllAddons,
  mergeProducts,
  normalizeRemoteAddon,
  normalizeRemoteProduct,
  type CatalogSource,
} from "@/lib/catalog";
import type { Product } from "@/data/products";
import type { Addon } from "@/data/addons";

export function useCatalog() {
  const [remoteProducts, setRemoteProducts] = useState<Product[]>([]);
  const [remoteAddons, setRemoteAddons] = useState<Addon[]>([]);
  const [productsReady, setProductsReady] = useState(false);
  const [addonsReady, setAddonsReady] = useState(false);

  useEffect(() => {
    const unsubscribeProducts = onSnapshot(
      collection(db, CATALOG_PRODUCTS_COLLECTION),
      (snapshot) => {
        setRemoteProducts(snapshot.docs.map(normalizeRemoteProduct).filter((product): product is Product => Boolean(product)));
        setProductsReady(true);
      },
      (error) => {
        console.warn("[catalog] Firestore de produtos indisponivel; usando fallback local.", error);
        setRemoteProducts([]);
        setProductsReady(true);
      },
    );

    const unsubscribeAddons = onSnapshot(
      collection(db, CATALOG_ADDONS_COLLECTION),
      (snapshot) => {
        setRemoteAddons(snapshot.docs.map(normalizeRemoteAddon).filter((addon): addon is Addon => Boolean(addon)));
        setAddonsReady(true);
      },
      (error) => {
        console.warn("[catalog] Firestore de adicionais indisponivel; usando fallback local.", error);
        setRemoteAddons([]);
        setAddonsReady(true);
      },
    );

    return () => {
      unsubscribeProducts();
      unsubscribeAddons();
    };
  }, []);

  const products = useMemo(() => mergeProducts(remoteProducts), [remoteProducts]);
  const allAddons = useMemo(() => mergeAllAddons(remoteAddons), [remoteAddons]);
  const addons = useMemo(() => mergeAddons(remoteAddons), [remoteAddons]);
  const source: CatalogSource = remoteProducts.length || remoteAddons.length ? "hybrid" : "fallback";

  return {
    products,
    addons,
    allAddons,
    source,
    loading: !productsReady || !addonsReady,
    remoteProducts: remoteProducts.length,
    remoteAddons: remoteAddons.length,
  };
}
