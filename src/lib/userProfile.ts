import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SavedAddress = {
  cep: string;
  street: string;
  number: string;
  district: string;
  complement: string;
  reference: string;
};

export type UserProfile = {
  name: string;
  email: string;
  photoURL?: string;
  phone: string;
  phoneE164: string;
  phoneVerified: boolean;
  address: SavedAddress;
  profileVersion: number;
  authProviders: string[];
};

export type UserProfileInput = {
  name: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  district: string;
  complement: string;
  reference: string;
};

const clean = (value: unknown) => String(value ?? "").trim();

export function phoneDigitsBR(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function phoneToE164BR(value: string) {
  const digits = phoneDigitsBR(value);
  return digits.length >= 10 ? `+55${digits}` : "";
}

export function formatPhoneBR(value: string) {
  let digits = phoneDigitsBR(value);
  digits = digits.replace(/^(\d{2})(\d)/, "($1) $2");
  digits = digits.replace(/(\d)(\d{4})$/, "$1-$2");
  return digits;
}

export function formatCEPBR(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function normalizeProfile(data: unknown): UserProfile | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const addressRaw = raw.address && typeof raw.address === "object"
    ? raw.address as Record<string, unknown>
    : {};

  return {
    name: clean(raw.name ?? raw.nome),
    email: clean(raw.email),
    photoURL: clean(raw.photoURL) || undefined,
    phone: formatPhoneBR(clean(raw.phone ?? raw.telefone)),
    phoneE164: clean(raw.phoneE164),
    phoneVerified: raw.phoneVerified === true,
    address: {
      cep: formatCEPBR(clean(addressRaw.cep ?? raw.cep)),
      street: clean(addressRaw.street ?? addressRaw.rua ?? raw.rua),
      number: clean(addressRaw.number ?? addressRaw.numero ?? raw.numero),
      district: clean(addressRaw.district ?? addressRaw.bairro ?? raw.bairro),
      complement: clean(addressRaw.complement ?? addressRaw.complemento ?? raw.complemento),
      reference: clean(addressRaw.reference ?? addressRaw.referencia ?? raw.referencia),
    },
    profileVersion: Number(raw.profileVersion) || 1,
    authProviders: Array.isArray(raw.authProviders)
      ? raw.authProviders.map(clean).filter(Boolean)
      : [],
  };
}

export function userProviders(user: User) {
  return Array.from(new Set(user.providerData.map((provider) => provider.providerId).filter(Boolean)));
}

export async function ensureUserBaseProfile(user: User) {
  const ref = doc(db, "Usuarios", user.uid);
  const existing = await getDoc(ref);

  const base = {
    name: clean(user.displayName),
    email: clean(user.email),
    photoURL: clean(user.photoURL),
    authProviders: userProviders(user),
    profileVersion: 2,
    updatedAt: serverTimestamp(),
  };

  if (existing.exists()) {
    await setDoc(ref, base, { merge: true });
  } else {
    await setDoc(ref, {
      ...base,
      phone: "",
      phoneE164: "",
      phoneVerified: false,
      address: {
        cep: "",
        street: "",
        number: "",
        district: "",
        complement: "",
        reference: "",
      },
      createdAt: serverTimestamp(),
    }, { merge: true });
  }
}

export async function saveUserProfile(user: User, input: UserProfileInput) {
  const phone = formatPhoneBR(input.phone);
  const phoneE164 = phoneToE164BR(phone);

  await setDoc(doc(db, "Usuarios", user.uid), {
    name: clean(input.name) || clean(user.displayName),
    email: clean(user.email),
    photoURL: clean(user.photoURL),
    phone,
    phoneE164,
    phoneVerified: false,
    phoneSource: "checkout",
    address: {
      cep: formatCEPBR(input.cep),
      street: clean(input.street),
      number: clean(input.number),
      district: clean(input.district),
      complement: clean(input.complement),
      reference: clean(input.reference),
    },
    authProviders: userProviders(user),
    profileVersion: 2,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
