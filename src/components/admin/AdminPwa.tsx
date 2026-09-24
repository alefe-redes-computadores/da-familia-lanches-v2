"use client";

import { useEffect } from "react";

export function AdminPwa() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const adminHost = window.location.hostname === "admin.dafamilialanches.com.br";
    const scope = adminHost ? "/" : "/admin/";
    navigator.serviceWorker.register("/admin-sw.js?v=67", { scope }).catch((error) => {
      console.warn("[admin-pwa] Service worker indisponível.", error);
    });
  }, []);
  return null;
}
