import type { Metadata } from "next";
export const metadata: Metadata = { manifest: "/admin-manifest.json", applicationName: "Da Família Lanches — Admin", appleWebApp: { capable: true, title: "DFL Admin", statusBarStyle: "black-translucent" } };
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
