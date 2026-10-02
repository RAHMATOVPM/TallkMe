import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Ban, Check, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import {
  adminDecide,
  adminGetTranscript,
  adminListReports,
  adminLogin,
} from "@/lib/admin.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — TalkMe" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type Status = "pending" | "banned" | "dismissed";

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_id: string;
  room_id: string | null;
  reason: string;
  created_at: string;
  status: string;
  ai_violation: boolean | null;
  ai_category: string | null;
  bannedUntil: string | null;
}

interface Msg {
  id: string;
  content: string;
  deleted: boolean;
  createdAt: string;
  role: "reported" | "reporter";
}

const CODE_KEY = "talkme.admin.code";

function AdminPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [status, setStatus] = useState<Status>("pending");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(
    async (c: string, s: Status, silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await adminListReports({ data: { code: c, status: s } });
        if (res.ok) {
          setReports((prev) => {
            const next = res.reports as ReportRow[];
            return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
          });
        } else setAuthed(false);
      } catch {
        /* сеть недоступна — попробуем на следующем тике */
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const saved = sessionStorage.getItem(CODE_KEY);
    if (!saved) return;
    (async () => {
      const res = await adminLogin({ data: { code: saved } });
      if (res.ok) {
        setCode(saved);
        setAuthed(true);
        void load(saved, "pending");
      } else {
        sessionStorage.removeItem(CODE_KEY);
      }
    })();
  }, [load]);

  const signIn = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminLogin({ data: { code: code.trim() } });
      if (!res.ok) {
        setError("Неверный код");
        return;
      }
      sessionStorage.setItem(CODE_KEY, code.trim());
      setAuthed(true);
      void load(code.trim(), status);
    } finally {
      setBusy(false);
    }
  };

  const openReport = async (id: string) => {
    setOpenId(id);
    setMessages([]);
    setMsgLoading(true);
    setDeciding(false);
    try {
      const res = await adminGetTranscript({ data: { code, reportId: id } });
      if (res.ok) setMessages(res.messages as Msg[]);
    } finally {
      setMsgLoading(false);
    }
  };

  const decide = async (id: string, action: "ban" | "dismiss") => {
    setBusy(true);
    try {
      await adminDecide({ data: { code, reportId: id, action } });
      setOpenId(null);
      await load(code, status);
    } finally {
      setBusy(false);
    }
  };

  // живое обновление списка жалоб
  useEffect(() => {
    if (!authed || !code) return;
    const tick = () => {
      if (document.visibilityState === "visible") void load(code, status, true);
    };
    const id = window.setInterval(tick, 4000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [authed, code, status, load]);

  // живое обновление открытой переписки
  useEffect(() => {
    if (!authed || !code || !openId) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        try {
          const res = await adminGetTranscript({ data: { code, reportId: openId } });
          if (res.ok) {
            setMessages((prev) => {
              const next = res.messages as Msg[];
              return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
            });
          }
        } catch {
          /* игнорируем разовые сбои сети */
        }
      })();
    }, 3000);
    return () => window.clearInterval(id);
  }, [authed, code, openId]);


  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <div className="card-soft p-6 animate-fade-up">
          <div className="mb-4 flex items-center gap-3">
            <Lock className="h-5 w-5" />
            <h1 className="text-lg font-bold">Админ-панель</h1>
          </div>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
            placeholder="Секретный код"
            className="mb-3 w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <button
            onClick={signIn}
            disabled={busy}
            className="btn-pill btn-brand w-full !rounded-2xl !py-3"
          >
            {busy ? <div className="ios-spinner" /> : <ShieldCheck className="h-5 w-5" />}
            Войти
          </button>
          <button
            onClick={() => navigate({ to: "/" })}
            className="btn-pill btn-ghost-pill mt-2 w-full !rounded-2xl !py-3"
          >
            Назад
          </button>
        </div>
      </main>
    );
  }

  const openReportRow = reports.find((r) => r.id === openId) ?? null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-8">
      <header className="mb-4 flex items-center gap-3 animate-fade-up">
        <button
          onClick={() => navigate({ to: "/" })}
          className="btn-pill btn-ghost-pill !p-3"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-xl font-bold">Жалобы</h1>
        <button
          onClick={() => load(code, status)}
          className="btn-pill btn-ghost-pill !p-3"
          aria-label="Обновить"
        >
          <RefreshCw className={"h-5 w-5 " + (loading ? "animate-spin" : "")} />
        </button>
      </header>

      <div className="mb-4 flex gap-2 animate-fade-up">
        {([
          ["pending", "Новые"],
          ["banned", "Забанены"],
          ["dismissed", "Отклонены"],
        ] as const).map(([s, label]) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              void load(code, s);
            }}
            className={
              "btn-pill flex-1 !px-3 !py-2 text-xs " +
              (status === s ? "btn-brand" : "btn-ghost-pill")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {!loading && reports.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Пусто</p>
      )}

      <div className="space-y-2">
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => openReport(r.id)}
            className="card-soft w-full p-4 text-left animate-fade-up"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">
                ID {r.reported_id.slice(0, 8)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {!r.reason || r.reason === "user_report" ? "Без комментария" : r.reason}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              {r.ai_violation && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
                  ИИ: нарушение{r.ai_category ? ` · ${r.ai_category}` : ""}
                </span>
              )}
              {r.bannedUntil && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                  Бан до {new Date(r.bannedUntil).toLocaleString()}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <Dialog open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Переписка</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
            {msgLoading && (
              <div className="flex justify-center py-6">
                <div className="ios-spinner ios-spinner-brand" />
              </div>
            )}
            {!msgLoading && messages.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Сообщений нет</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={"flex " + (m.role === "reported" ? "justify-start" : "justify-end")}
              >
                <div
                  className={
                    "max-w-[80%] rounded-3xl px-4 py-2 text-sm " +
                    (m.role === "reported"
                      ? "bg-destructive/10 text-foreground"
                      : "bg-card text-foreground border border-border")
                  }
                >
                  <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.role === "reported" ? "Нарушитель" : "Автор жалобы"}
                  </div>
                  {m.deleted ? <em className="text-muted-foreground">удалено</em> : m.content}
                </div>
              </div>
            ))}
          </div>

          {openReportRow?.status === "pending" && !deciding && (
            <button
              disabled={msgLoading}
              onClick={() => setDeciding(true)}
              className="btn-pill btn-brand w-full !rounded-2xl !py-3 text-sm"
            >
              Принять решение
            </button>
          )}

          {openReportRow?.status === "pending" && deciding && (
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => {
                  setDeciding(false);
                  if (openId) void decide(openId, "dismiss");
                }}
                className="btn-pill btn-ghost-pill flex-1 !rounded-2xl !py-3 text-sm"
              >
                <Check className="h-4 w-4" />
                Не блокировать
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setDeciding(false);
                  if (openId) void decide(openId, "ban");
                }}
                className="btn-pill flex-1 !rounded-2xl !py-3 text-sm bg-destructive text-destructive-foreground"
              >
                <Ban className="h-4 w-4" />
                Бан 24 ч
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
