"use client";

import { useEffect, useState } from "react";
import { getEffectiveShopStatus, getScheduleShopStatus, type ShopStatus } from "@/lib/shopStatus";

const REFRESH_MS = 5 * 60 * 1000;

let status: ShopStatus = getScheduleShopStatus();
let loadedAt = 0;
let inflight: Promise<ShopStatus> | null = null;
let timer: number | undefined;
let refs = 0;

const listeners = new Set<(value: ShopStatus) => void>();

function emit() {
  listeners.forEach((listener) => listener(status));
}

async function load(force = false) {
  if (!force && loadedAt && Date.now() - loadedAt < REFRESH_MS) {
    return status;
  }

  if (inflight) return inflight;

  inflight = getEffectiveShopStatus()
    .then((next) => {
      status = next;
      loadedAt = Date.now();
      emit();
      return next;
    })
    .catch((error) => {
      console.warn("[shop-status] leitura remota indisponível", error);
      status = getScheduleShopStatus();
      loadedAt = Date.now();
      emit();
      return status;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

function startTimer() {
  if (timer || typeof window === "undefined") return;

  timer = window.setInterval(() => {
    void load(true);
  }, REFRESH_MS);
}

function stopTimer() {
  if (!timer || typeof window === "undefined") return;
  window.clearInterval(timer);
  timer = undefined;
}

function subscribe(listener: (value: ShopStatus) => void) {
  listeners.add(listener);
  refs += 1;

  listener(status);
  void load();
  startTimer();

  return () => {
    listeners.delete(listener);
    refs = Math.max(0, refs - 1);

    if (!refs) stopTimer();
  };
}

export function refreshShopStatus() {
  loadedAt = 0;
  return load(true);
}

export function useShopStatus(): ShopStatus {
  const [snapshot, setSnapshot] = useState(status);

  useEffect(() => subscribe(setSnapshot), []);

  return snapshot;
}
