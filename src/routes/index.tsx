import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Settings as SettingsIcon, MessageCircle, Sparkles } from "lucide-react";
import { useApp, type Gender, type UserProfile } from "@/lib/app-context";
import { useOnlineCount } from "@/lib/use-online";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { feedback } from "@/lib/feedback";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TalkMe — Anonymous chat" },
      { name: "description", content: "Pick your gender, age and start chatting anonymously." },
    ],
  }),
  component: Home,
});

function Home() {
  const { t, profile, setProfile, userId, brand } = useApp();
  const online = useOnlineCount(userId);
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);

  const [gender, setGender] = useState<Gender>(profile?.gender ?? "male");
  const [age, setAge] = useState<number>(profile?.age ?? 21);
  const [wantGender, setWantGender] = useState<Gender>(
    (profile?.wantGender as Gender) ?? "female",
  );
  const [ageRange, setAgeRange] = useState<[number, number]>([
    profile?.wantAgeMin ?? 18,
    profile?.wantAgeMax ?? 20,
  ]);
  const [banned, setBanned] = useState(false);

  const draft: UserProfile = useMemo(
    () => ({
      userId,
      gender,
      age,
      wantGender,
      wantAgeMin: ageRange[0],
      wantAgeMax: ageRange[1],
    }),
    [userId, gender, age, wantGender, ageRange],
  );

  // Poll for partner while searching
  useEffect(() => {
    if (!searching) return;
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.rpc("find_room_for_user", { p_user_id: userId });
      if (!cancelled && typeof data === "string" && data) {
        setSearching(false);
        feedback("match");
        navigate({ to: "/chat/$roomId", params: { roomId: data } });
      }
    };
    check();
    const id = setInterval(check, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [searching, userId, navigate]);

  const handleFind = async () => {
    if (!userId) return;
    setProfile(draft);
    setSearching(true);
    const { data, error } = await supabase.rpc("find_or_queue_match", {
      p_user_id: userId,
      p_gender: gender,
      p_age: age,
      p_want_gender: wantGender,
      p_want_age_min: ageRange[0],
      p_want_age_max: ageRange[1],
    });
    if (error) {
      console.error(error);
      setBanned(error.message.includes("USER_BANNED"));
      setSearching(false);
      return;
    }
    setBanned(false);
    if (typeof data === "string" && data) {
      setSearching(false);
      feedback("match");
      navigate({ to: "/chat/$roomId", params: { roomId: data } });
    }
  };

  const handleCancel = async () => {
    setSearching(false);
    await supabase.from("waiting_queue").delete().eq("user_id", userId);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-32 pt-4">
      {banned && (
        <div className="card-soft mb-4 border border-destructive/40 px-4 py-3 text-sm text-destructive animate-fade-up">
          {t("banned24")}
        </div>
      )}
      <header className="mb-4 flex items-center justify-between animate-fade-up">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand)] text-[var(--brand-foreground)] shadow-[0_10px_30px_-10px_var(--brand-glow)]">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">TalkMe</span>
        </div>
        <Link to="/settings" className="btn-pill btn-ghost-pill !p-3" aria-label={t("settings")}>
          <SettingsIcon className="h-5 w-5" />
        </Link>
      </header>

      <section className="card-soft mb-4 flex items-center justify-between gap-3 px-5 py-3 animate-fade-up">
        <div className="flex items-center gap-3">
          <span className="pulse-dot" />
          <div>
            <div className="text-2xl font-bold tabular-nums">{online}</div>
            <div className="text-xs text-muted-foreground">{t("online")}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground capitalize">{brand}</div>
      </section>

      {searching ? (
        <SearchingPanel onCancel={handleCancel} />
      ) : (
        <div className="card-soft p-4 animate-fade-up">
          <h2 className="mb-1 text-base font-semibold">{t("tagline")}</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            <Sparkles className="mr-1 inline h-4 w-4" />
            {t("findPartner")}
          </p>

          <Field label={t("yourGender")}>
            <Segmented
              value={gender}
              onChange={(v) => setGender(v as Gender)}
              options={[
                { value: "male", label: t("male") },
                { value: "female", label: t("female") },
              ]}
            />
          </Field>

          <Field label={`${t("yourAge")}: ${age === 30 ? "30+" : age === 18 ? "18–20" : "21–25"}`}>
            <ChipGroup
              value={age}
              onChange={setAge}
              options={[
                { value: 18, label: "18–20" },
                { value: 21, label: "21–25" },
                { value: 30, label: "30+" },
              ]}
            />
          </Field>

          <div className="my-3 h-px bg-border" />

          <Field label={t("lookingFor")}>
            <Segmented
              value={wantGender}
              onChange={(v) => setWantGender(v as Gender)}
              options={[
                { value: "male", label: t("male") },
                { value: "female", label: t("female") },
              ]}
            />
          </Field>

          <Field label={`${t("ageRange")}: ${ageRange[0] === 30 ? "30+" : `${ageRange[0]}–${ageRange[1]}`}`}>
            <ChipGroup
              value={`${ageRange[0]}-${ageRange[1]}`}
              onChange={(v) => {
                const [a, b] = String(v).split("-").map(Number);
                setAgeRange([a, b]);
              }}
              options={[
                { value: "18-20", label: "18–20" },
                { value: "21-25", label: "21–25" },
                { value: "30-99", label: "30+" },
              ]}
            />
          </Field>

          <button onClick={handleFind} className="btn-pill btn-brand mt-4 w-full text-base">
            <MessageCircle className="h-5 w-5" />
            {t("findPartner")}
          </button>
        </div>
      )}
      <BottomNav />
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              "btn-pill flex-1 text-sm " + (active ? "btn-brand" : "btn-ghost-pill")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ChipGroup<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<T | { value: T; label: string }>;
}) {
  const norm = options.map((o) =>
    typeof o === "object" ? o : { value: o, label: String(o) },
  );
  return (
    <div className="flex flex-wrap gap-2">
      {norm.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              "btn-pill !px-4 !py-2 text-sm " +
              (active ? "btn-brand" : "btn-ghost-pill")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SearchingPanel({ onCancel }: { onCancel: () => void }) {
  const { t } = useApp();
  return (
    <div className="card-soft flex flex-col items-center gap-4 p-6 animate-fade-up">
      <div className="relative grid h-24 w-24 place-items-center">
        <div className="absolute inset-0 animate-float rounded-full bg-[var(--brand)]/20 blur-2xl" />
        <div className="grid h-20 w-20 place-items-center rounded-full bg-[var(--brand)] text-[var(--brand-foreground)] shadow-[0_20px_50px_-10px_var(--brand-glow)]">
          <MessageCircle className="h-9 w-9" />
        </div>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-full animate-shimmer" />
      </div>
      <p className="text-sm text-muted-foreground">{t("searching")}</p>
      <button onClick={onCancel} className="btn-pill btn-ghost-pill w-full">
        {t("cancel")}
      </button>
    </div>
  );
}
