import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Poppins } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Da Família Lanches", template: "%s | Da Família Lanches" },
  description: "Cardápio Da Família Lanches. Escolha, personalize e faça seu pedido.",
  manifest: "/manifest.json",
  applicationName: "Da Família Lanches",
  appleWebApp: { capable: true, title: "Da Família", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icon-192x192.png", sizes: "192x192", type: "image/png" }, { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" }],
    shortcut: "/icon-192x192.png",
    apple: [{ url: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111111",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body className={poppins.className}><AppShell>{children}</AppShell></body></html>;
}
