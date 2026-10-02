import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    [
      {
        relation: [
          "delegate_permission/common.handle_all_urls",
        ],
        target: {
          namespace: "android_app",
          package_name: "br.com.dafamilialanches.admin",
          sha256_cert_fingerprints: [
            "77:F6:88:B5:32:06:0E:41:35:C2:9F:4E:24:22:4A:6C:34:C0:F1:74:DB:D2:65:E4:BD:27:50:6D:88:17:55:63",
          ],
        },
      },
    ],
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
