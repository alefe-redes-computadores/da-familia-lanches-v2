export const BUSINESS_CONTACT = {
  pixKey: "34997178336",
  whatsappNumber: "5534997178336",
  whatsappUrl: "https://wa.me/5534997178336",
} as const;

export function businessWhatsAppUrl(message?: string) {
  return message
    ? `${BUSINESS_CONTACT.whatsappUrl}?text=${encodeURIComponent(message)}`
    : BUSINESS_CONTACT.whatsappUrl;
}
