"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CATALOG_CATEGORIES_COLLECTION, mergeCategories, normalizeRemoteCategory, type CatalogCategory } from "@/lib/catalogCategories";

export function useCatalogCategories() {
  const [remote, setRemote] = useState<CatalogCategory[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => onSnapshot(collection(db, CATALOG_CATEGORIES_COLLECTION), (snapshot) => {
    setRemote(snapshot.docs.map(normalizeRemoteCategory).filter((category): category is CatalogCategory => Boolean(category)));
    setReady(true);
  }, (error) => {
    console.warn("[catalog] Categorias remotas indisponiveis; usando fallback.", error);
    setRemote([]); setReady(true);
  }), []);
  const categories = useMemo(() => mergeCategories(remote), [remote]);
  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories]);
  return { categories, activeCategories, loading: !ready, source: remote.length ? "remote" as const : "fallback" as const, remoteCategories: remote.length };
}
