"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
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

export function useCustomerRewards() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [config, setConfig] = useState<RewardsConfig>(DEFAULT_REWARDS_CONFIG);
  const [rewards, setRewards] = useState<CustomerReward[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [rewardsLoading, setRewardsLoading] = useState(Boolean(currentUser));
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(
    doc(db, REWARDS_CONFIG_COLLECTION, REWARDS_CONFIG_ID),
    (snapshot) => {
      setConfig(snapshot.exists() ? normalizeRewardsConfig(snapshot.data()) : DEFAULT_REWARDS_CONFIG);
      setConfigLoading(false);
    },
    () => {
      setConfig(DEFAULT_REWARDS_CONFIG);
      setConfigLoading(false);
    },
  ), []);

  useEffect(() => {
    if (!currentUser) {
      setRewards([]);
      setRewardsLoading(false);
      return;
    }

    setRewardsLoading(true);
    return onSnapshot(
      collection(db, "Usuarios", currentUser.uid, "RecompensasRecebidas"),
      (snapshot) => {
        const next = snapshot.docs
          .map((document) => normalizeReward(document.id, document.data()))
          .filter(Boolean) as CustomerReward[];
        next.sort((a, b) => (b.earnedAt?.toMillis() ?? 0) - (a.earnedAt?.toMillis() ?? 0));
        setRewards(next);
        setRewardsLoading(false);
        setError("");
      },
      (reason) => {
        console.error(reason);
        setRewards([]);
        setRewardsLoading(false);
        setError("Não foi possível carregar suas recompensas agora.");
      },
    );
  }, [currentUser]);

  return useMemo(() => {
    const available = rewards.filter((reward) => !reward.used && !rewardIsExpired(reward));
    const used = rewards.filter((reward) => reward.used);
    const expired = rewards.filter((reward) => !reward.used && rewardIsExpired(reward));
    return {
      config,
      rewards,
      available,
      used,
      expired,
      loading: configLoading || rewardsLoading,
      error,
    };
  }, [config, rewards, configLoading, rewardsLoading, error]);
}
