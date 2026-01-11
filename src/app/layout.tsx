import type { Metadata } from "next";
import "./globals.css";

import { Poppins } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ModalRoot } from "@/components/ui/ModalRoot";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

// ATUALIZAÇÃO DO METADATA PARA PWA
export const metadata: Metadata = {
  title: "Da Família Lanches",
  description: "DFL — Cardápio e pedidos online",
  manifest: "/manifest.json", // <-- Isso avisa ao celular sobre o PWA
  themeColor: "#ffca28",      // <-- Define a cor da barra do sistema
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  icons: {
    apple: "/icon-192x192.png", // Para iPhones
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
        {/* Algumas tags extras para garantir que o iOS entenda que é um App */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
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
