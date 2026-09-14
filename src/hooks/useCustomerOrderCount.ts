"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth.store";

export function useCustomerOrderCount() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(currentUser));

  useEffect(() => {
    if (!currentUser) {
      setCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    return onSnapshot(
      doc(db, "Usuarios", currentUser.uid),
      (snapshot) => {
        setCount(snapshot.exists() ? Number(snapshot.data().pedidosFeitos) || 0 : 0);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao acompanhar histórico do cliente", error);
        setLoading(false);
      }
    );
  }, [currentUser]);

  return { count, loading };
}
