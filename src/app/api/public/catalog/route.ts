import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/integration/server/admin";
import {
  CATALOG_ADDONS_COLLECTION,
  CATALOG_PRODUCTS_COLLECTION,
} from "@/lib/catalog";
import { CATALOG_CATEGORIES_COLLECTION } from "@/lib/catalogCategories";
import {
  errorCode,
  finishRouteTrace,
  startRouteTrace,
} from "@/lib/server/observability";

export const runtime = "nodejs";

const SNAPSHOT_COLLECTION = "public_materialized";
const SNAPSHOT_DOCUMENT = "catalog_v1";
const SNAPSHOT_MAX_AGE_MS = 60 * 60 * 1000;

type CatalogSnapshot = {
  products: Array<{ id: string; data: FirebaseFirestore.DocumentData }>;
  addons: Array<{ id: string; data: FirebaseFirestore.DocumentData }>;
  categories: Array<{ id: string; data: FirebaseFirestore.DocumentData }>;
  generatedAt: string;
};

function isFreshSnapshot(value: unknown): value is CatalogSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<CatalogSnapshot>;
  if (
    !Array.isArray(snapshot.products) ||
    !Array.isArray(snapshot.addons) ||
    !Array.isArray(snapshot.categories) ||
    typeof snapshot.generatedAt !== "string"
  ) {
    return false;
  }

  const generatedAt = Date.parse(snapshot.generatedAt);
  return Number.isFinite(generatedAt) &&
    Date.now() - generatedAt < SNAPSHOT_MAX_AGE_MS;
}

async function rebuildCatalogSnapshot(): Promise<CatalogSnapshot> {
  const trace = startRouteTrace("public.catalog.firestore_rebuild");

  const [products, addons, categories] = await Promise.all([
    adminDb.collection(CATALOG_PRODUCTS_COLLECTION).get(),
    adminDb.collection(CATALOG_ADDONS_COLLECTION).get(),
    adminDb.collection(CATALOG_CATEGORIES_COLLECTION).get(),
  ]);

  const payload: CatalogSnapshot = {
    products: products.docs.map((document) => ({
      id: document.id,
      data: document.data(),
    })),
    addons: addons.docs.map((document) => ({
      id: document.id,
      data: document.data(),
    })),
    categories: categories.docs.map((document) => ({
      id: document.id,
      data: document.data(),
    })),
    generatedAt: new Date().toISOString(),
  };

  // Materialização compartilhada no próprio Firestore:
  // cold starts/instâncias diferentes passam a pagar 1 leitura em vez de
  // varrer três coleções inteiras. Falha de escrita não derruba o catálogo.
  try {
    await adminDb
      .collection(SNAPSHOT_COLLECTION)
      .doc(SNAPSHOT_DOCUMENT)
      .set(payload, { merge: false });
  } catch (error) {
    console.warn("[public.catalog] snapshot materializado não persistido", error);
  }

  finishRouteTrace(trace, "ok", {
    firestoreDocuments: products.size + addons.size + categories.size,
    products: products.size,
    addons: addons.size,
    categories: categories.size,
    materialized: true,
  });

  return payload;
}

async function readCatalog(): Promise<CatalogSnapshot> {
  const trace = startRouteTrace("public.catalog.refresh");

  try {
    const materialized = await adminDb
      .collection(SNAPSHOT_COLLECTION)
      .doc(SNAPSHOT_DOCUMENT)
      .get();

    const data = materialized.exists ? materialized.data() : null;

    if (isFreshSnapshot(data)) {
      finishRouteTrace(trace, "ok", {
        firestoreDocuments: 1,
        source: "materialized",
        ageMs: Date.now() - Date.parse(data.generatedAt),
      });
      return data;
    }

    finishRouteTrace(trace, "ok", {
      firestoreDocuments: 1,
      source: materialized.exists ? "materialized_stale" : "materialized_missing",
    });
  } catch (error) {
    finishRouteTrace(trace, "error", {
      errorCode: errorCode(error),
      source: "materialized_read",
    });
  }

  return rebuildCatalogSnapshot();
}

const cachedCatalog = unstable_cache(readCatalog, ["public-catalog-v3-budget"], {
  revalidate: 3600,
  tags: ["public-catalog"],
});

export async function GET() {
  const trace = startRouteTrace("public.catalog.request");

  try {
    const payload = await cachedCatalog();
    finishRouteTrace(trace, "ok", {
      cachePolicy: "3600s",
      generatedAt: payload.generatedAt,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        "x-dfl-trace-id": trace.id,
        "x-dfl-catalog-version": "budget-v1",
      },
    });
  } catch (error) {
    finishRouteTrace(trace, "error", { errorCode: errorCode(error) });

    return NextResponse.json(
      {
        products: [],
        addons: [],
        categories: [],
        generatedAt: null,
        degraded: true,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "x-dfl-trace-id": trace.id,
        },
      },
    );
  }
}
