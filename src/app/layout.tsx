import type { Metadata } from "next";
import "./globals.css";

import { Poppins } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ModalRoot } from "@/components/ui/ModalRoot";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

// CONFIGURAÇÃO REFORÇADA: PWA + FAVICON
export const metadata: Metadata = {
  title: "Da Família Lanches",
  description: "Você faz parte disso ❤️",
  manifest: "/manifest.json",
  themeColor: "#ffca28",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icon-192x192.png",
    apple: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={poppins.className}>
        <AppShell>
          {children}
        </AppShell>
        <ModalRoot />
      </body>
    </html>
  );
}
