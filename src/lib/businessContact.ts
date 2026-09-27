export const BUSINESS_CONTACT = {
  pixKey: "34997178336",
  whatsappNumber: "5534997178336",
  whatsappUrl: "https://wa.me/5534997178336",
  instagramHandle: "@dafamilia_patos",
  instagramUrl: "https://www.instagram.com/dafamilia_patos/",
  address:
    "Rua Lázaro Martins Marciel (Rua 7), 164 - Jardim Quebec, Patos de Minas/MG",
} as const;

export function businessWhatsAppUrl(message?: string) {
  return message
    ? `${BUSINESS_CONTACT.whatsappUrl}?text=${encodeURIComponent(message)}`
    : BUSINESS_CONTACT.whatsappUrl;
}
