"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import type { CustomerOrder } from "@/hooks/useCustomerOrders";

type State = { order: CustomerOrder | null; loading: boolean; error: string; at: number };
const TERMINAL = ["Finalizado", "Cancelado"];
const TTL = 10 * 60_000;
const cache = new Map<string, State>();
const inflight = new Map<string, Promise<State>>();
const listeners = new Map<string, Set<(state: State) => void>>();

function emit(uid: string, state: State) {
  cache.set(uid, state);
  listeners.get(uid)?.forEach((listener) => listener(state));
}

async function load(uid: string, force = false) {
  const known = cache.get(uid);
  if (!force && known && Date.now() - known.at < TTL) return known;
  const pending = inflight.get(uid);
  if (!force && pending) return pending;

  const request = getDocs(
    query(
      collection(db, "Pedidos"),
      where("userId", "==", uid),
      where("status", "in", TERMINAL),
      orderBy("data", "desc"),
      limit(1),
    ),
  )
    .then((snapshot) => {
      const document = snapshot.docs[0];
      const state: State = {
        order: document ? ({ id: document.id, ...document.data() } as CustomerOrder) : null,
        loading: false,
        error: "",
        at: Date.now(),
      };
      emit(uid, state);
      return state;
    })
    .catch((reason) => {
      console.error(reason);
      const state: State = {
        order: known?.order ?? null,
        loading: false,
        error: "Não foi possível carregar seu último pedido agora.",
        at: Date.now(),
      };
      emit(uid, state);
      return state;
    })
    .finally(() => inflight.delete(uid));

  inflight.set(uid, request);
  return request;
}

export function useLastCustomerOrder(user: User | null | undefined) {
  const [state, setState] = useState<State>(() =>
    user ? cache.get(user.uid) ?? { order: null, loading: true, error: "", at: 0 } : { order: null, loading: false, error: "", at: 0 },
  );

  useEffect(() => {
    if (!user) {
      setState({ order: null, loading: false, error: "", at: 0 });
      return;
    }

    const uid = user.uid;
    let bucket = listeners.get(uid);
    if (!bucket) {
      bucket = new Set();
      listeners.set(uid, bucket);
    }
    bucket.add(setState);

    const known = cache.get(uid);
    if (known) setState(known);
    void load(uid);

    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string }>).detail;
      if (!detail?.uid || detail.uid === uid) void load(uid, true);
    };
    window.addEventListener("dfl:customer-order-terminal", refresh);

    return () => {
      bucket?.delete(setState);
      if (bucket?.size === 0) listeners.delete(uid);
      window.removeEventListener("dfl:customer-order-terminal", refresh);
    };
  }, [user?.uid]);

  return {
    lastOrder: state.order,
    loading: state.loading,
    error: state.error,
    reload: () => user ? load(user.uid, true) : Promise.resolve(null),
  };
}
