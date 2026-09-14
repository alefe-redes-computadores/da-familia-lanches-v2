"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { orderDateToMillis } from "@/lib/orderCompat";
import { normalizarStatus } from "@/lib/orderUtils";

export type CustomerOrder = Record<string, any> & { id: string };

export function useCustomerOrders(user: User | null | undefined) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    const q = query(collection(db, "Pedidos"), where("userId", "==", user.uid));
    return onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map((item): CustomerOrder => ({ id: item.id, ...item.data() } as CustomerOrder))
        .sort((a, b) => orderDateToMillis(b.data ?? b.createdAt ?? b.statusUpdatedAt) - orderDateToMillis(a.data ?? a.createdAt ?? a.statusUpdatedAt)));
      setLoading(false);
      setError("");
    }, (reason) => {
      console.error(reason);
      setError("Não foi possível acompanhar seus pedidos agora.");
      setLoading(false);
    });
  }, [user]);

  const activeOrders = useMemo(() => orders.filter((order) => !["Finalizado", "Cancelado"].includes(normalizarStatus(order.status))), [orders]);
  const pastOrders = useMemo(() => orders.filter((order) => ["Finalizado", "Cancelado"].includes(normalizarStatus(order.status))), [orders]);
  return { orders, activeOrders, pastOrders, loading, error };
}
