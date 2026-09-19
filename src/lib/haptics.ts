export type HapticKind = "add" | "remove" | "restore" | "step" | "success" | "error";
export function haptic(kind: HapticKind = "step") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const pattern: number | number[] = kind === "add" ? 24 : kind === "remove" ? [18, 26, 18] : kind === "restore" ? [12, 16, 26] : kind === "success" ? [16,22,30] : kind === "error" ? [28,35,28] : 10;
  navigator.vibrate(pattern);
}
