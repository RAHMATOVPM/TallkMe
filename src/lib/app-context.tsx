import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translations, type Lang, type TKey } from "./i18n";

export type Brand =
  | "white"
  | "pink"
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "red"
  | "yellow"
  | "teal"
  | "mint";

export const BRANDS: { code: Brand; label: string; color: string }[] = [
  { code: "white", label: "White", color: "oklch(0.98 0.005 280)" },
  { code: "pink", label: "Pink", color: "oklch(0.82 0.14 350)" },
  { code: "blue", label: "Blue", color: "oklch(0.72 0.16 240)" },
  { code: "purple", label: "Purple", color: "oklch(0.68 0.19 300)" },
  { code: "green", label: "Green", color: "oklch(0.78 0.17 145)" },
  { code: "orange", label: "Orange", color: "oklch(0.78 0.17 55)" },
  { code: "red", label: "Red", color: "oklch(0.68 0.22 25)" },
  { code: "yellow", label: "Yellow", color: "oklch(0.88 0.16 95)" },
  { code: "teal", label: "Teal", color: "oklch(0.75 0.13 195)" },
  { code: "mint", label: "Mint", color: "oklch(0.86 0.12 165)" },
];

export type Theme = "dark" | "light";
export type Gender = "male" | "female";

export interface UserProfile {
  userId: string;
  gender: Gender;
  age: number;
  wantGender: Gender | "any";
  wantAgeMin: number;
  wantAgeMax: number;
}

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  brand: Brand;
  setBrand: (b: Brand) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  profile: UserProfile | null;
  setProfile: (p: UserProfile | null) => void;
  sound: boolean;
  setSound: (v: boolean) => void;
  vibration: boolean;
  setVibration: (v: boolean) => void;
  t: (k: TKey) => string;
  userId: string;
}

const Ctx = createContext<AppState | null>(null);

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "u-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [lang, setLangState] = useState<Lang>("ru");
  const [brand, setBrandState] = useState<Brand>("white");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [sound, setSoundState] = useState<boolean>(true);
  const [vibration, setVibrationState] = useState<boolean>(true);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    setLangState(readLS<Lang>("talkme_lang", "ru"));
    setBrandState(readLS<Brand>("talkme_brand", "white"));
    setThemeState(readLS<Theme>("talkme_theme", "dark"));
    setProfileState(readLS<UserProfile | null>("talkme_profile", null));
    setSoundState(readLS<boolean>("talkme_sound", true));
    setVibrationState(readLS<boolean>("talkme_vibration", true));
    setHydrated(true);
    // Invisible anonymous sign-in: the server verifies identity via auth.uid().
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      let uid = data.session?.user.id;
      if (!uid) {
        const { data: signed, error } = await supabase.auth.signInAnonymously();
        if (error) console.error("[auth] anonymous sign-in failed", error.message);
        uid = signed.user?.id;
      }
      if (uid) setUserId(uid);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute("data-brand", brand);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.lang = lang;
  }, [brand, theme, lang, hydrated]);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("talkme_lang", JSON.stringify(l));
  };
  const setBrand = (b: Brand) => {
    setBrandState(b);
    localStorage.setItem("talkme_brand", JSON.stringify(b));
  };
  const setTheme = (tm: Theme) => {
    setThemeState(tm);
    localStorage.setItem("talkme_theme", JSON.stringify(tm));
  };
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const setProfile = (p: UserProfile | null) => {
    setProfileState(p);
    if (p) localStorage.setItem("talkme_profile", JSON.stringify(p));
    else localStorage.removeItem("talkme_profile");
  };
  const setSound = (v: boolean) => {
    setSoundState(v);
    localStorage.setItem("talkme_sound", JSON.stringify(v));
  };
  const setVibration = (v: boolean) => {
    setVibrationState(v);
    localStorage.setItem("talkme_vibration", JSON.stringify(v));
  };

  const value = useMemo<AppState>(
    () => ({
      lang,
      setLang,
      brand,
      setBrand,
      theme,
      setTheme,
      toggleTheme,
      profile,
      setProfile,
      sound,
      setSound,
      vibration,
      setVibration,
      userId,
      t: (k) => translations[lang]?.[k] ?? translations.en[k],
    }),
    [lang, brand, theme, profile, sound, vibration, userId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
