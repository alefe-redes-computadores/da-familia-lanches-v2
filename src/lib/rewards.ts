import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  limit,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizarStatus } from "@/lib/orderUtils";

export const REWARDS_CONFIG_COLLECTION = "RecompensasConfig";
export const REWARDS_CONFIG_ID = "loyalty";

export type RewardDiscountType = "fixed" | "percent";

export type RewardsConfig = {
  active: boolean;
  title: string;
  description: string;
  everyOrders: number;
  discountType: RewardDiscountType;
  discountValue: number;
  minOrder: number;
  expiresDays: number;
};

export type CustomerReward = {
  id: string;
  campaignId: string;
  code: string;
  title: string;
  description: string;
  discountType: RewardDiscountType;
  discountValue: number;
  minOrder: number;
  milestone: number;
  completedOrdersAtAward: number;
  used: boolean;
  usedOrderId?: string | null;
  earnedAt?: Timestamp | null;
  usedAt?: Timestamp | null;
  expiresAt?: Timestamp | null;
};

export const DEFAULT_REWARDS_CONFIG: RewardsConfig = {
  active: false,
  title: "Fidelidade Da Família",
  description: "Benefício liberado por pedidos finalizados.",
  everyOrders: 5,
  discountType: "fixed",
  discountValue: 10,
  minOrder: 0,
  expiresDays: 30,
};

const safeNumber = (value: unknown, fallback: number, min = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
};

export function normalizeRewardsConfig(data: unknown): RewardsConfig {
  const raw = data && typeof data === "object" ? data as Record<string, unknown> : {};
  return {
    active: raw.active === true,
    title: String(raw.title ?? DEFAULT_REWARDS_CONFIG.title).trim() || DEFAULT_REWARDS_CONFIG.title,
    description: String(raw.description ?? DEFAULT_REWARDS_CONFIG.description).trim() || DEFAULT_REWARDS_CONFIG.description,
    everyOrders: Math.max(1, Math.floor(safeNumber(raw.everyOrders, DEFAULT_REWARDS_CONFIG.everyOrders, 1))),
    discountType: raw.discountType === "percent" ? "percent" : "fixed",
    discountValue: safeNumber(raw.discountValue, DEFAULT_REWARDS_CONFIG.discountValue, 0.01),
    minOrder: safeNumber(raw.minOrder, DEFAULT_REWARDS_CONFIG.minOrder, 0),
    expiresDays: Math.max(0, Math.floor(safeNumber(raw.expiresDays, DEFAULT_REWARDS_CONFIG.expiresDays, 0))),
  };
}

export function normalizeReward(id: string, data: unknown): CustomerReward | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const code = String(raw.code ?? "").trim().toUpperCase();
  if (!code) return null;

  return {
    id,
    campaignId: String(raw.campaignId ?? REWARDS_CONFIG_ID),
    code,
    title: String(raw.title ?? "Recompensa"),
    description: String(raw.description ?? ""),
    discountType: raw.discountType === "percent" ? "percent" : "fixed",
    discountValue: safeNumber(raw.discountValue, 0, 0),
    minOrder: safeNumber(raw.minOrder, 0, 0),
    milestone: Math.max(1, Math.floor(safeNumber(raw.milestone, 1, 1))),
    completedOrdersAtAward: Math.max(1, Math.floor(safeNumber(raw.completedOrdersAtAward, 1, 1))),
    used: raw.used === true,
    usedOrderId: typeof raw.usedOrderId === "string" ? raw.usedOrderId : null,
    earnedAt: raw.earnedAt instanceof Timestamp ? raw.earnedAt : null,
    usedAt: raw.usedAt instanceof Timestamp ? raw.usedAt : null,
    expiresAt: raw.expiresAt instanceof Timestamp ? raw.expiresAt : null,
  };
}

export function rewardIsExpired(reward: CustomerReward, now = Date.now()) {
  return Boolean(reward.expiresAt && reward.expiresAt.toMillis() < now);
}

export function rewardDiscount(reward: CustomerReward, subtotal: number) {
  if (reward.used || rewardIsExpired(reward)) return 0;
  if (subtotal < reward.minOrder) return 0;

  const raw = reward.discountType === "percent"
    ? (subtotal * reward.discountValue) / 100
    : reward.discountValue;

  return Math.min(subtotal, Math.max(0, raw));
}

export async function findCustomerRewardByCode(userId: string, code: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return null;
  const snapshot = await getDocs(query(
    collection(db, "Usuarios", userId, "RecompensasRecebidas"),
    where("code", "==", normalizedCode),
    limit(1),
  ));
  const document = snapshot.docs[0];
  return document ? normalizeReward(document.id, document.data()) : null;
}

const rewardCode = (userId: string, milestone: number) =>
  `DFL${userId.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase()}${String(milestone).padStart(2, "0")}`;

export type RewardGrantPlan = {
  id: string;
  userId: string;
  data: {
    campaignId: string;
    code: string;
    title: string;
    description: string;
    discountType: RewardDiscountType;
    discountValue: number;
    minOrder: number;
    milestone: number;
    completedOrdersAtAward: number;
    used: false;
    usedOrderId: null;
    usedAt: null;
    expiresAt: Timestamp | null;
  };
};

export async function prepareRewardForFinalizedOrder(order: Record<string, unknown>): Promise<RewardGrantPlan | null> {
  const userId = String(order.userId ?? "").trim();
  if (!userId) return null;

  const configSnapshot = await getDoc(doc(db, REWARDS_CONFIG_COLLECTION, REWARDS_CONFIG_ID));
  if (!configSnapshot.exists()) return null;
  const config = normalizeRewardsConfig(configSnapshot.data());
  if (!config.active) return null;

  const currentOrderId = String(order.id ?? "");
  const ordersSnapshot = await getDocs(query(collection(db, "Pedidos"), where("userId", "==", userId)));
  const completedAfterTransition = ordersSnapshot.docs.filter((candidate) =>
    candidate.id !== currentOrderId &&
    normalizarStatus(typeof candidate.data().status === "string" ? candidate.data().status : undefined) === "Finalizado"
  ).length + 1;

  if (completedAfterTransition <= 0 || completedAfterTransition % config.everyOrders !== 0) return null;

  const milestone = completedAfterTransition / config.everyOrders;
  const now = Timestamp.now();
  const expiresAt = config.expiresDays > 0
    ? Timestamp.fromMillis(now.toMillis() + config.expiresDays * 86_400_000)
    : null;

  return {
    id: `${REWARDS_CONFIG_ID}-${milestone}`,
    userId,
    data: {
      campaignId: REWARDS_CONFIG_ID,
      code: rewardCode(userId, milestone),
      title: config.title,
      description: config.description,
      discountType: config.discountType,
      discountValue: config.discountValue,
      minOrder: config.minOrder,
      milestone,
      completedOrdersAtAward: completedAfterTransition,
      used: false,
      usedOrderId: null,
      usedAt: null,
      expiresAt,
    },
  };
}
