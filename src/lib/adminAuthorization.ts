export const ADMIN_EMAILS = [
  "alefejohsefe@gmail.com",
  "kalebhstanley650@gmail.com",
  "contato@dafamilialanches.com.br",
  "carols2maite@gmail.com",
  "degustbolosnopote@gmail.com",
  "viniciusrdefreitas@gmail.com",
] as const;

export function isAdminEmail(email: unknown): boolean {
  const normalized = String(email ?? "").trim().toLowerCase();
  return ADMIN_EMAILS.some((item) => item === normalized);
}
