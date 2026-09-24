import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const adminHost = (request.headers.get("host") || "").split(":")[0].toLowerCase() === "admin.dafamilialanches.com.br";
  const root = adminHost ? "/" : "/admin";
  return NextResponse.json({
    id: root,
    name: "DFL Admin",
    short_name: "DFL Admin",
    description: "Central operacional da Da Família Lanches",
    lang: "pt-BR",
    start_url: root,
    scope: adminHost ? "/" : "/admin/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/admin-icon-192x192.png?v=54", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/admin-icon-512x512.png?v=54", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/admin-icon-maskable-192x192.png?v=54", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/admin-icon-maskable-512x512.png?v=54", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Pedidos", short_name: "Pedidos", url: root }],
  }, { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=300" } });
}
