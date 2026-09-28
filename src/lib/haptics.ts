export type HapticKind =
  | "add"
  | "remove"
  | "restore"
  | "step"
  | "success"
  | "error";

export function haptic(kind: HapticKind = "step") {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function"
  ) return;

  // Feedback tátil é confirmação, não decoração.
  // Em reduced-motion mantemos somente erros/sucessos relevantes.
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced && !["success", "error"].includes(kind)) return;

  const pattern: Record<HapticKind, number | number[]> = {
    add: 18,
    remove: [12, 22, 12],
    restore: [10, 14, 20],
    step: 8,
    success: [12, 18, 24],
    error: [24, 28, 24],
  };

  navigator.vibrate(pattern[kind]);
}
