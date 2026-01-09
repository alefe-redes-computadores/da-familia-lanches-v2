import type { Metadata } from "next";
import "./globals.css";

import { Poppins } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ModalRoot } from "@/components/ui/ModalRoot";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Da Família Lanches",
  description: "DFL — Cardápio e pedidos online",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={poppins.className}>
        <AppShell>
          {children}
        </AppShell>
        <ModalRoot />
      </body>
    </html>
  );
}