import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Volume2, VolumeX, Vibrate, VibrateOff, Moon, Sun, ChevronDown, ChevronRight, ScrollText, ShieldCheck, Bell, BellOff } from "lucide-react";
import { useApp, BRANDS, type Brand } from "@/lib/app-context";
import { feedback } from "@/lib/feedback";
import {
  getNotifPref,
  getPermission,
  requestNotifPermission,
  setNotifPref,
  type NotifPermission,
} from "@/lib/notifications";
import { LANGUAGES, type Lang } from "@/lib/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Settings — TalkMe" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const {
    t, lang, setLang, brand, setBrand,
    theme, setTheme,
    sound, setSound, vibration, setVibration,
  } = useApp();

  const navigate = useNavigate();
  const tapsRef = useRef<{ count: number; last: number }>({ count: 0, last: 0 });

  const secretTap = () => {
    const now = Date.now();
    const s = tapsRef.current;
    s.count = now - s.last < 800 ? s.count + 1 : 1;
    s.last = now;
    if (s.count >= 7) {
      s.count = 0;
      feedback("tap");
      navigate({ to: "/admin" });
    }
  };

  const [notifPerm, setNotifPerm] = useState<NotifPermission>("default");
  const [notifOn, setNotifOn] = useState(false);

  useEffect(() => {
    const perm = getPermission();
    setNotifPerm(perm);
    setNotifOn(perm === "granted" && getNotifPref());
  }, []);


  const currentLang = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  const currentBrand = BRANDS.find((b) => b.code === brand) ?? BRANDS[0];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-8">
      <header className="mb-6 flex items-center gap-3 animate-fade-up">
        <Link to="/" className="btn-pill btn-ghost-pill !p-3" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="select-none text-xl font-bold" onClick={secretTap}>
          {t("settings")}
        </h1>
      </header>

      {/* Language */}
      <section className="card-soft mb-4 p-5 animate-fade-up">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("language")}
        </h2>
        <Popover>
          <PopoverTrigger asChild>
            <button className="btn-pill btn-ghost-pill w-full justify-between !rounded-2xl !px-4 !py-3">
              <span className="flex items-center gap-3">
                <span className="text-xl leading-none">{currentLang.flag}</span>
                <span className="font-medium">{currentLang.native}</span>
              </span>
              <ChevronDown className="h-5 w-5 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            sideOffset={8}
            className="w-[calc(100vw-2.5rem)] max-w-sm rounded-3xl border-border bg-popover/95 p-2 backdrop-blur-xl"
          >
            <div className="mb-2 px-2 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("chooseLanguage")}
            </div>
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {LANGUAGES.map((l) => {
                const active = l.code === lang;
                return (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code as Lang)}
                    className={
                      "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors " +
                      (active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60")
                    }
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xl leading-none">{l.flag}</span>
                      <span className="text-sm font-medium">{l.native}</span>
                      <span className="text-xs text-muted-foreground">{l.label}</span>
                    </span>
                    {active && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </section>

      {/* Brand color */}
      <section className="card-soft mb-4 p-5 animate-fade-up">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("buttonColor")}
        </h2>
        <Popover>
          <PopoverTrigger asChild>
            <button className="btn-pill btn-ghost-pill w-full justify-between !rounded-2xl !px-4 !py-3">
              <span className="flex items-center gap-3">
                <span
                  className="h-7 w-7 rounded-full border border-border shadow-inner"
                  style={{ background: currentBrand.color }}
                />
                <span className="font-medium">{currentBrand.label}</span>
              </span>
              <ChevronDown className="h-5 w-5 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            sideOffset={8}
            className="w-[calc(100vw-2.5rem)] max-w-sm rounded-3xl border-border bg-popover/95 p-3 backdrop-blur-xl"
          >
            <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("chooseColor")}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {BRANDS.map((b) => {
                const active = b.code === brand;
                return (
                  <button
                    key={b.code}
                    onClick={() => setBrand(b.code as Brand)}
                    aria-label={b.label}
                    className={
                      "relative flex aspect-square items-center justify-center rounded-2xl border transition-all " +
                      (active
                        ? "border-foreground/60 scale-105"
                        : "border-border hover:border-foreground/30")
                    }
                    style={{ background: b.color }}
                  >
                    {active && (
                      <Check
                        className="h-5 w-5"
                        style={{ color: "oklch(0.15 0.02 280)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </section>

      {/* Theme */}
      <section className="card-soft mb-4 p-5 animate-fade-up">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("appearance")}
        </h2>
        <div className="flex gap-2">
          {([
            ["dark", t("dark"), Moon],
            ["light", t("light"), Sun],
          ] as const).map(([code, label, Icon]) => {
            const active = theme === code;
            return (
              <button
                key={code}
                onClick={() => setTheme(code)}
                className={
                  "btn-pill flex-1 !rounded-2xl !py-3 text-sm " +
                  (active ? "btn-brand" : "btn-ghost-pill")
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Feedback */}
      <section className="card-soft p-5 animate-fade-up">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("feedback")}
        </h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              const next = !sound;
              setSound(next);
              if (next) setTimeout(() => feedback("message"), 0);
            }}
            className={
              "btn-pill w-full justify-between !rounded-2xl !px-4 !py-3 " +
              (sound ? "btn-brand" : "btn-ghost-pill")
            }
          >
            <span className="flex items-center gap-3">
              {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              <span className="font-medium text-sm">{t("sound")}</span>
            </span>
            {sound && <Check className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !vibration;
              setVibration(next);
              if (next) setTimeout(() => feedback("message"), 0);
            }}
            className={
              "btn-pill w-full justify-between !rounded-2xl !px-4 !py-3 " +
              (vibration ? "btn-brand" : "btn-ghost-pill")
            }
          >
            <span className="flex items-center gap-3">
              {vibration ? <Vibrate className="h-5 w-5" /> : <VibrateOff className="h-5 w-5" />}
              <span className="font-medium text-sm">{t("vibration")}</span>
            </span>
            {vibration && <Check className="h-5 w-5" />}
          </button>
          <button
            type="button"
            disabled={notifPerm === "unsupported" || notifPerm === "denied"}
            onClick={async () => {
              feedback("tap");
              if (notifOn) {
                setNotifOn(false);
                setNotifPref(false);
                return;
              }
              const perm = await requestNotifPermission();
              setNotifPerm(perm);
              const granted = perm === "granted";
              setNotifOn(granted);
              setNotifPref(granted);
            }}
            className={
              "btn-pill w-full justify-between !rounded-2xl !px-4 !py-3 disabled:opacity-50 " +
              (notifOn ? "btn-brand" : "btn-ghost-pill")
            }
          >
            <span className="flex items-center gap-3">
              {notifOn ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              <span className="flex flex-col items-start">
                <span className="text-sm font-medium">{t("notifications")}</span>
                {notifPerm === "denied" && (
                  <span className="text-[11px] opacity-70">{t("notificationsBlocked")}</span>
                )}
                {notifPerm === "unsupported" && (
                  <span className="text-[11px] opacity-70">{t("notificationsUnsupported")}</span>
                )}
              </span>
            </span>
            {notifOn && <Check className="h-5 w-5" />}
          </button>
        </div>
      </section>


      {/* Legal */}
      <section className="card-soft mt-4 p-5 animate-fade-up">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("legal")}
        </h2>
        <div className="space-y-2">
          {([
            ["rules", t("rules"), t("rulesBody"), ScrollText],
            ["privacy", t("privacy"), t("privacyBody"), ShieldCheck],
          ] as const).map(([key, title, body, Icon]) => (
            <Dialog key={key}>
              <DialogTrigger asChild>
                <button className="btn-pill btn-ghost-pill w-full justify-between !rounded-2xl !px-4 !py-3">
                  <span className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{title}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 opacity-70" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-sm rounded-3xl">
                <DialogHeader>
                  <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1 text-sm leading-relaxed text-muted-foreground">
                  {body.split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </section>
    </main>
  );
}
