"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getScheduleShopStatus,
  statusFromSetting,
  type ShopStatus,
} from "@/lib/shopStatus";

export function useShopStatus(): ShopStatus {
  const [scheduled, setScheduled] = useState<ShopStatus>(() => getScheduleShopStatus());
  const [remote, setRemote] = useState<ShopStatus | null>(null);

  useEffect(() => {
    const updateSchedule = () => setScheduled(getScheduleShopStatus());
    updateSchedule();
    const interval = window.setInterval(updateSchedule, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return onSnapshot(
      doc(db, "settings", "loja"),
      (snap) => {
        if (!snap.exists()) {
          setRemote(null);
          return;
        }
        setRemote(statusFromSetting(snap.data().isOpen));
      },
      () => setRemote(null)
    );
  }, []);

  return useMemo(() => remote ?? scheduled, [remote, scheduled]);
}
