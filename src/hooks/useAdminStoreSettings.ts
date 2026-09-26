"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_STORE_SETTINGS, normalizeStoreSettings, type StoreSettings } from "@/lib/storeSchedule";
import { recordFirestoreReadEstimate } from "@/lib/firestoreReadBudget";

type State = { settings: StoreSettings; ready: boolean; error: string };
let state: State = { settings: DEFAULT_STORE_SETTINGS, ready: false, error: "" };
let stop: Unsubscribe | undefined;
let refs = 0;
let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<(value: State) => void>();

function emit() { listeners.forEach((listener) => listener(state)); }
function start() {
  if (stop) return;
  stop = onSnapshot(
    doc(db, "settings", "loja"),
    (snapshot) => {
      recordFirestoreReadEstimate("admin.settings.loja", snapshot.exists() ? 1 : 0);
      state = {
        settings: snapshot.exists() ? normalizeStoreSettings(snapshot.data()) : DEFAULT_STORE_SETTINGS,
        ready: true,
        error: "",
      };
      emit();
    },
    (error) => {
      console.error(error);
      state = { ...state, ready: true, error: "Não foi possível acompanhar o funcionamento da loja." };
      emit();
    },
  );
}

function subscribe(listener: (value: State) => void) {
  if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = undefined; }
  listeners.add(listener);
  refs += 1;
  start();
  listener(state);
  return () => {
    listeners.delete(listener);
    refs = Math.max(0, refs - 1);
    if (refs > 0) return;
    cleanupTimer = setTimeout(() => {
      if (refs > 0) return;
      stop?.();
      stop = undefined;
      cleanupTimer = undefined;
    }, 90_000);
  };
}

export function useAdminStoreSettings(
  enabled = true,
) {
  const [snapshot, setSnapshot] =
    useState(state);

  useEffect(() => {
    if (!enabled) return;

    return subscribe(setSnapshot);
  }, [enabled]);

  return enabled
    ? snapshot
    : {
        ...snapshot,
        ready: false,
      };
}
