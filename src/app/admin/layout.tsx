import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "DFL Admin",
  description: "Painel administrativo da Da Família Lanches",
  applicationName: "DFL Admin",
  manifest: "/admin-manifest.json?v=51",
  appleWebApp: {
    capable: true,
    title: "DFL Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=23", sizes: "any" },
      { url: "/icon-192x192.png?v=23", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png?v=23", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=23", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b0c",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
