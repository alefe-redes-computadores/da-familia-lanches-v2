"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth.store";
import {
  DEFAULT_REWARDS_CONFIG,
  normalizeReward,
  normalizeRewardsConfig,
  rewardIsExpired,
  REWARDS_CONFIG_COLLECTION,
  REWARDS_CONFIG_ID,
  type CustomerReward,
  type RewardsConfig,
} from "@/lib/rewards";

/*
 * ------------------------------------------------------------
 * CONFIGURAÇÃO DE FIDELIDADE
 * ------------------------------------------------------------
 *
 * Antes cada instância do hook mantinha onSnapshot permanente
 * em RecompensasConfig/loyalty.
 *
 * Essa configuração não é operacional em tempo real como o
 * status de um pedido. Agora ela usa cache compartilhado de 5 min.
 */

type ConfigState = {
  config: RewardsConfig;
  loading: boolean;
};

const CONFIG_TTL_MS = 5 * 60_000;

let configState: ConfigState = {
  config: DEFAULT_REWARDS_CONFIG,
  loading: true,
};

let configFetchedAt = 0;
let configInflight: Promise<void> | null = null;

const configListeners =
  new Set<(state: ConfigState) => void>();

function emitConfig() {
  configListeners.forEach((listener) =>
    listener(configState),
  );
}

async function loadConfig(force = false) {
  const fresh =
    configFetchedAt > 0 &&
    Date.now() - configFetchedAt < CONFIG_TTL_MS;

  if (!force && fresh) return;
  if (!force && configInflight) return configInflight;

  configInflight = getDoc(
    doc(
      db,
      REWARDS_CONFIG_COLLECTION,
      REWARDS_CONFIG_ID,
    ),
  )
    .then((snapshot) => {
      configState = {
        config: snapshot.exists()
          ? normalizeRewardsConfig(snapshot.data())
          : DEFAULT_REWARDS_CONFIG,
        loading: false,
      };

      configFetchedAt = Date.now();
      emitConfig();
    })
    .catch((reason) => {
      console.error(reason);

      configState = {
        config: DEFAULT_REWARDS_CONFIG,
        loading: false,
      };

      configFetchedAt = Date.now();
      emitConfig();
    })
    .finally(() => {
      configInflight = null;
    });

  return configInflight;
}

function subscribeConfig(
  listener: (state: ConfigState) => void,
) {
  configListeners.add(listener);
  listener(configState);
  void loadConfig();

  return () => {
    configListeners.delete(listener);
  };
}

/*
 * ------------------------------------------------------------
 * RECOMPENSAS DO CLIENTE
 * ------------------------------------------------------------
 *
 * Recompensas continuam realtime.
 *
 * A diferença é que agora TODAS as instâncias do hook para o
 * mesmo UID compartilham um único listener.
 *
 * Também existe janela de graça de 90 s para impedir que abrir,
 * fechar e reabrir modal faça novo snapshot inicial imediatamente.
 */

type RewardsState = {
  rewards: CustomerReward[];
  loading: boolean;
  error: string;
};

type RewardsEntry = {
  state: RewardsState;
  listeners: Set<(state: RewardsState) => void>;
  refs: number;
  stop?: Unsubscribe;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

const rewardEntries =
  new Map<string, RewardsEntry>();

const REWARDS_LISTENER_GRACE_MS = 90_000;

function rewardsEntry(uid: string) {
  const existing = rewardEntries.get(uid);
  if (existing) return existing;

  const created: RewardsEntry = {
    state: {
      rewards: [],
      loading: true,
      error: "",
    },
    listeners: new Set(),
    refs: 0,
  };

  rewardEntries.set(uid, created);
  return created;
}

function emitRewards(current: RewardsEntry) {
  current.listeners.forEach((listener) =>
    listener(current.state),
  );
}

function startRewards(
  uid: string,
  current: RewardsEntry,
) {
  if (current.stop) return;

  current.stop = onSnapshot(
    collection(
      db,
      "Usuarios",
      uid,
      "RecompensasRecebidas",
    ),
    (snapshot) => {
      const rewards = snapshot.docs
        .map((document) =>
          normalizeReward(
            document.id,
            document.data(),
          ),
        )
        .filter(Boolean) as CustomerReward[];

      rewards.sort(
        (a, b) =>
          (b.earnedAt?.toMillis() ?? 0) -
          (a.earnedAt?.toMillis() ?? 0),
      );

      current.state = {
        rewards,
        loading: false,
        error: "",
      };

      emitRewards(current);
    },
    (reason) => {
      console.error(reason);

      /*
       * Também preservamos recompensas já conhecidas numa falha.
       */
      current.state = {
        ...current.state,
        loading: false,
        error:
          "Não foi possível carregar suas recompensas agora.",
      };

      emitRewards(current);
    },
  );
}

function subscribeRewards(
  uid: string,
  listener: (state: RewardsState) => void,
) {
  const current = rewardsEntry(uid);

  if (current.cleanupTimer) {
    clearTimeout(current.cleanupTimer);
    current.cleanupTimer = undefined;
  }

  current.listeners.add(listener);
  current.refs += 1;

  startRewards(uid, current);
  listener(current.state);

  return () => {
    current.listeners.delete(listener);
    current.refs = Math.max(0, current.refs - 1);

    if (current.refs > 0) return;

    current.cleanupTimer = setTimeout(() => {
      if (current.refs > 0) return;

      current.stop?.();
      current.stop = undefined;
      current.cleanupTimer = undefined;
    }, REWARDS_LISTENER_GRACE_MS);
  };
}

export function useCustomerRewards() {
  const currentUser =
    useAuthStore((state) => state.currentUser);

  const [configSnapshot, setConfigSnapshot] =
    useState<ConfigState>(configState);

  const [rewardSnapshot, setRewardSnapshot] =
    useState<RewardsState>({
      rewards: [],
      loading: Boolean(currentUser),
      error: "",
    });

  useEffect(
    () => subscribeConfig(setConfigSnapshot),
    [],
  );

  useEffect(() => {
    if (!currentUser) {
      setRewardSnapshot({
        rewards: [],
        loading: false,
        error: "",
      });
      return;
    }

    const current =
      rewardsEntry(currentUser.uid);

    setRewardSnapshot(current.state);

    return subscribeRewards(
      currentUser.uid,
      setRewardSnapshot,
    );
  }, [currentUser?.uid]);

  return useMemo(() => {
    const available =
      rewardSnapshot.rewards.filter(
        (reward) =>
          !reward.used &&
          !rewardIsExpired(reward),
      );

    const used =
      rewardSnapshot.rewards.filter(
        (reward) => reward.used,
      );

    const expired =
      rewardSnapshot.rewards.filter(
        (reward) =>
          !reward.used &&
          rewardIsExpired(reward),
      );

    return {
      config: configSnapshot.config,
      rewards: rewardSnapshot.rewards,
      available,
      used,
      expired,
      loading:
        configSnapshot.loading ||
        rewardSnapshot.loading,
      error: rewardSnapshot.error,
    };
  }, [
    configSnapshot,
    rewardSnapshot,
  ]);
}
