import type { Metadata, Viewport } from "next";
import "./admin-ui.css";
import { AdminPwa } from "@/components/admin/AdminPwa";

export const metadata: Metadata = {
  title: "DFL Admin",
  description: "Painel administrativo da Da Família Lanches",
  applicationName: "DFL Admin",
  manifest: "/admin-manifest.webmanifest?v=68",
  appleWebApp: {
    capable: true,
    title: "DFL Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      {
        url: "/admin-icon-192x192.png?v=54",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/admin-icon-512x512.png?v=54",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcut: "/admin-icon-192x192.png?v=54",
    apple: [
      {
        url: "/admin-apple-touch-icon.png?v=54",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b0c",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div data-admin-ui><AdminPwa />{children}</div>;
}
