"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { normalizeProfile, type UserProfile } from "@/lib/userProfile";

export function useUserProfile(user: User | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    return onSnapshot(
      doc(db, "Usuarios", user.uid),
      (snapshot) => {
        setProfile(snapshot.exists() ? normalizeProfile(snapshot.data()) : null);
        setLoading(false);
      },
      (error) => {
        console.warn("[profile] Não foi possível carregar o perfil.", error);
        setProfile(null);
        setLoading(false);
      },
    );
  }, [user]);

  return { profile, loading };
}
