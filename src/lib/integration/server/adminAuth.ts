import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/integration/server/admin";

export const adminAuth = getAuth(adminApp);
