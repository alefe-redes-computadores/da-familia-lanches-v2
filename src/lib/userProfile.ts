import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SavedAddress = {
  id: string;
  label: string;
  cep: string;
  street: string;
  number: string;
  district: string;
  complement: string;
  reference: string;
  isDefault: boolean;
};

export type UserProfile = {
  name: string;
  email: string;
  photoURL?: string;
  phone: string;
  phoneE164: string;
  phoneVerified: boolean;
  address: SavedAddress;
  addresses: SavedAddress[];
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

export type ProfileSource = "checkout" | "account";
export const MAX_SAVED_ADDRESSES = 3;

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
    address: (() => {
      const list = Array.isArray(raw.addresses) ? raw.addresses : [];
      const parsed = list.map((item, index) => {
        const a = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return { id: clean(a.id) || `address-${index + 1}`, label: clean(a.label) || (index === 0 ? "Casa" : `Endereço ${index + 1}`), cep: formatCEPBR(clean(a.cep)), street: clean(a.street ?? a.rua), number: clean(a.number ?? a.numero), district: clean(a.district ?? a.bairro), complement: clean(a.complement ?? a.complemento), reference: clean(a.reference ?? a.referencia), isDefault: a.isDefault === true };
      }).filter((a) => a.street || a.district || a.number || a.cep).slice(0, 3);
      const legacy = { id: "address-1", label: "Casa", cep: formatCEPBR(clean(addressRaw.cep ?? raw.cep)), street: clean(addressRaw.street ?? addressRaw.rua ?? raw.rua), number: clean(addressRaw.number ?? addressRaw.numero ?? raw.numero), district: clean(addressRaw.district ?? addressRaw.bairro ?? raw.bairro), complement: clean(addressRaw.complement ?? addressRaw.complemento ?? raw.complemento), reference: clean(addressRaw.reference ?? addressRaw.referencia ?? raw.referencia), isDefault: true };
      const normalized = parsed.length ? parsed : (legacy.street || legacy.district || legacy.number || legacy.cep ? [legacy] : []);
      if (normalized.length && !normalized.some((a) => a.isDefault)) normalized[0] = { ...normalized[0], isDefault: true };
      return normalized.find((a) => a.isDefault) || normalized[0] || { ...legacy, isDefault: false };
    })(),
    addresses: (() => {
      const list = Array.isArray(raw.addresses) ? raw.addresses : [];
      let parsed = list.map((item, index) => {
        const a = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return { id: clean(a.id) || `address-${index + 1}`, label: clean(a.label) || (index === 0 ? "Casa" : `Endereço ${index + 1}`), cep: formatCEPBR(clean(a.cep)), street: clean(a.street ?? a.rua), number: clean(a.number ?? a.numero), district: clean(a.district ?? a.bairro), complement: clean(a.complement ?? a.complemento), reference: clean(a.reference ?? a.referencia), isDefault: a.isDefault === true };
      }).filter((a) => a.street || a.district || a.number || a.cep).slice(0, 3);
      if (!parsed.length) {
        const legacy = { id: "address-1", label: "Casa", cep: formatCEPBR(clean(addressRaw.cep ?? raw.cep)), street: clean(addressRaw.street ?? addressRaw.rua ?? raw.rua), number: clean(addressRaw.number ?? addressRaw.numero ?? raw.numero), district: clean(addressRaw.district ?? addressRaw.bairro ?? raw.bairro), complement: clean(addressRaw.complement ?? addressRaw.complemento ?? raw.complemento), reference: clean(addressRaw.reference ?? addressRaw.referencia ?? raw.referencia), isDefault: true };
        if (legacy.street || legacy.district || legacy.number || legacy.cep) parsed = [legacy];
      }
      if (parsed.length && !parsed.some((a) => a.isDefault)) parsed[0] = { ...parsed[0], isDefault: true };
      let seen = false;
      return parsed.map((a) => a.isDefault && !seen ? (seen = true, a) : ({ ...a, isDefault: false })).sort((a,b)=>Number(b.isDefault)-Number(a.isDefault));
    })(),
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
  const current = existing.exists() ? normalizeProfile(existing.data()) : null;

  const base = {
    // Nome editado pelo cliente é fonte preferencial. O Google só preenche
    // quando ainda não existe um nome salvo.
    name: current?.name || clean(user.displayName),
    email: clean(user.email),
    photoURL: clean(user.photoURL),
    authProviders: userProviders(user),
    profileVersion: 4,
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
      address: { id: "", label: "Casa", cep: "", street: "", number: "", district: "", complement: "", reference: "", isDefault: false },
      addresses: [],
      createdAt: serverTimestamp(),
    }, { merge: true });
  }
}

export async function saveUserProfile(
  user: User,
  input: UserProfileInput,
  source: ProfileSource = "checkout",
) {
  const ref = doc(db, "Usuarios", user.uid);
  const existing = await getDoc(ref);
  const current = existing.exists() ? normalizeProfile(existing.data()) : null;
  const phone = formatPhoneBR(input.phone);
  const phoneE164 = phoneToE164BR(phone);
  const phoneVerified = Boolean(
    current?.phoneVerified
    && current.phoneE164
    && current.phoneE164 === phoneE164,
  );

  await setDoc(ref, {
    name: clean(input.name) || current?.name || clean(user.displayName),
    email: clean(user.email),
    photoURL: clean(user.photoURL),
    phone,
    phoneE164,
    phoneVerified,
    phoneSource: source,
    authProviders: userProviders(user),
    profileVersion: 4,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function saveUserAddresses(user: User, input: SavedAddress[]) {
  let addresses = input.slice(0, MAX_SAVED_ADDRESSES).map((a, index) => ({
    id: clean(a.id) || `address-${index + 1}`, label: clean(a.label) || (index === 0 ? "Casa" : `Endereço ${index + 1}`),
    cep: formatCEPBR(a.cep), street: clean(a.street), number: clean(a.number), district: clean(a.district),
    complement: clean(a.complement), reference: clean(a.reference), isDefault: a.isDefault === true,
  })).filter((a) => a.street || a.district || a.number || a.cep);
  if (addresses.length && !addresses.some((a) => a.isDefault)) addresses[0] = { ...addresses[0], isDefault: true };
  let seen = false;
  addresses = addresses.map((a) => a.isDefault && !seen ? (seen = true, a) : ({ ...a, isDefault: false })).sort((a,b)=>Number(b.isDefault)-Number(a.isDefault));
  const address = addresses.find((a) => a.isDefault) || addresses[0] || { id:"",label:"Casa",cep:"",street:"",number:"",district:"",complement:"",reference:"",isDefault:false };
  await setDoc(doc(db, "Usuarios", user.uid), { addresses, address, profileVersion: 4, updatedAt: serverTimestamp() }, { merge: true });
}
