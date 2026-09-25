"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { orderDateToMillis } from "@/lib/orderCompat";
import { normalizarStatus } from "@/lib/orderUtils";

export type CustomerOrder = Record<string, any> & { id: string };

type State = {
  orders: CustomerOrder[];
  loading: boolean;
  error: string;
};

type Entry = {
  state: State;
  listeners: Set<(state: State) => void>;
  stop?: Unsubscribe;
  refs: number;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

const entries = new Map<string, Entry>();

/*
 * O histórico completo continua sendo a fonte atual.
 *
 * A otimização desta cirurgia NÃO corta registros e NÃO muda status.
 * Ela evita destruir/recriar o onSnapshot durante navegações rápidas,
 * abertura/fechamento de modais e remounts da Home.
 */
const LISTENER_GRACE_MS = 90_000;

function entry(uid: string) {
  const existing = entries.get(uid);
  if (existing) return existing;

  const created: Entry = {
    state: {
      orders: [],
      loading: true,
      error: "",
    },
    listeners: new Set(),
    refs: 0,
  };

  entries.set(uid, created);
  return created;
}

function emit(current: Entry) {
  current.listeners.forEach((listener) => listener(current.state));
}

function start(uid: string, current: Entry) {
  if (current.stop) return;

  const q = query(
    collection(db, "Pedidos"),
    where("userId", "==", uid),
  );

  current.stop = onSnapshot(
    q,
    (snapshot) => {
      current.state = {
        orders: snapshot.docs
          .map(
            (document) =>
              ({
                id: document.id,
                ...document.data(),
              }) as CustomerOrder,
          )
          .sort(
            (a, b) =>
              orderDateToMillis(
                b.data ?? b.createdAt ?? b.statusUpdatedAt,
              ) -
              orderDateToMillis(
                a.data ?? a.createdAt ?? a.statusUpdatedAt,
              ),
          ),
        loading: false,
        error: "",
      };

      emit(current);
    },
    (reason) => {
      console.error(reason);

      /*
       * Preservamos os dados já carregados.
       * Uma falha temporária não apaga o histórico da tela.
       */
      current.state = {
        ...current.state,
        loading: false,
        error: "Não foi possível acompanhar seus pedidos agora.",
      };

      emit(current);
    },
  );
}

function subscribe(
  uid: string,
  listener: (state: State) => void,
) {
  const current = entry(uid);

  if (current.cleanupTimer) {
    clearTimeout(current.cleanupTimer);
    current.cleanupTimer = undefined;
  }

  current.listeners.add(listener);
  current.refs += 1;

  start(uid, current);
  listener(current.state);

  return () => {
    current.listeners.delete(listener);
    current.refs = Math.max(0, current.refs - 1);

    if (current.refs > 0) return;

    /*
     * Antes: o listener morria imediatamente.
     * Agora: mantemos 90 s de graça para navegações rápidas.
     *
     * Isso reduz reconexões que fariam o Firestore entregar
     * novamente o snapshot inicial do histórico.
     */
    current.cleanupTimer = setTimeout(() => {
      if (current.refs > 0) return;

      current.stop?.();
      current.stop = undefined;
      current.cleanupTimer = undefined;

      /*
       * Não apagamos current.state.
       * Se a tela voltar depois, ela pode mostrar o snapshot
       * conhecido enquanto o Firestore reconecta.
       */
    }, LISTENER_GRACE_MS);
  };
}

export function useCustomerOrders(
  user: User | null | undefined,
) {
  const [state, setState] = useState<State>({
    orders: [],
    loading: Boolean(user),
    error: "",
  });

  useEffect(() => {
    if (!user) {
      setState({
        orders: [],
        loading: false,
        error: "",
      });
      return;
    }

    const current = entry(user.uid);
    setState(current.state);

    return subscribe(user.uid, setState);
  }, [user?.uid]);

  const activeOrders = useMemo(
    () =>
      state.orders.filter(
        (order) =>
          !["Finalizado", "Cancelado"].includes(
            normalizarStatus(order.status),
          ),
      ),
    [state.orders],
  );

  const pastOrders = useMemo(
    () =>
      state.orders.filter((order) =>
        ["Finalizado", "Cancelado"].includes(
          normalizarStatus(order.status),
        ),
      ),
    [state.orders],
  );

  return {
    ...state,
    activeOrders,
    pastOrders,
  };
}
