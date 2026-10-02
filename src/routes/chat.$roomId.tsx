import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, AlertTriangle, WifiOff, Check, CheckCheck, Pencil, Trash2, X } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { feedback } from "@/lib/feedback";
import { useNetworkStatus } from "@/lib/use-network";
import { notifyMessage } from "@/lib/notifications";

import { reportChat } from "@/lib/moderation.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/chat/$roomId")({
  head: () => ({ meta: [{ title: "Chat — TalkMe" }] }),
  component: ChatPage,
});

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  pending?: boolean;
}

interface Room {
  id: string;
  user_a: string;
  user_b: string;
  active: boolean;
}

function ChatPage() {
  const { roomId } = Route.useParams();
  const { userId, t } = useApp();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportResult, setReportResult] = useState<string | null>(null);
  const network = useNetworkStatus();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upsert = useCallback((msg: Message) => {
    setMessages((prev) => {
      const i = prev.findIndex((m) => m.id === msg.id);
      if (i === -1) return [...prev, msg];
      const next = [...prev];
      next[i] = { ...next[i], ...msg, pending: false };
      return next;
    });
  }, []);

  // load room + history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: r } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();
      if (!cancelled && r) {
        setRoom(r as Room);
        if (!r.active) setPartnerLeft(true);
        else feedback("match");
      }
      const { data: m } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      if (!cancelled && m) setMessages(m as Message[]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // realtime subscribe
  useEffect(() => {
    const ch = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const msg = payload.new as Message;
          upsert(msg);
          if (msg.sender_id !== userId) {
            feedback("message");
            notifyMessage(t("newMessageTitle"), msg.content.slice(0, 120), `room-${roomId}`);
          }
        },

      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => upsert(payload.new as Message),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const r = payload.new as Room;
          setRoom(r);
          if (!r.active) {
            setPartnerLeft(true);
            feedback("leave");
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId, userId, upsert]);

  // mark partner messages as read
  useEffect(() => {
    const unread = messages.filter((m) => m.sender_id !== userId && !m.read_at && !m.pending);
    if (unread.length === 0) return;
    const ids = unread.map((m) => m.id);
    setMessages((prev) =>
      prev.map((m) => (ids.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m)),
    );
    void supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
  }, [messages, userId]);

  // auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const v = input.trim();
    if (!v) return;

    if (editingId) {
      const id = editingId;
      setEditingId(null);
      setInput("");
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: v, edited_at: new Date().toISOString() } : m)),
      );
      await supabase
        .from("messages")
        .update({ content: v, edited_at: new Date().toISOString() })
        .eq("id", id);
      return;
    }

    if (!room?.active) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Message = {
      id: tempId,
      room_id: roomId,
      sender_id: userId,
      content: v,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setInput("");
    setMessages((prev) => [...prev, optimistic]);

    const { data: inserted } = await supabase
      .from("messages")
      .insert({ room_id: roomId, sender_id: userId, content: v })
      .select()
      .maybeSingle();

    setMessages((prev) => {
      const without = prev.filter((m) => m.id !== tempId);
      if (!inserted) return without;
      if (without.some((m) => m.id === inserted.id)) return without;
      return [...without, inserted as Message];
    });
  };

  const removeMessage = async (id: string) => {
    setActionsFor(null);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m)),
    );
    await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  };

  const startEdit = (m: Message) => {
    setActionsFor(null);
    setEditingId(m.id);
    setInput(m.content);
    inputRef.current?.focus();
  };

  const leave = async () => {
    feedback("leave");
    await supabase.from("chat_rooms").update({ active: false }).eq("id", roomId);
    await supabase.from("waiting_queue").delete().eq("user_id", userId);
    navigate({ to: "/" });
  };

  const submitReport = async () => {
    if (reporting) return;
    setReporting(true);
    try {
      const res = await reportChat({
        data: { roomId, reason: reportReason.trim() || undefined },
      });
      if (!res.ok) {
        setReportResult(t("reportError"));
      } else {
        setReportResult(res.violation ? t("reportBanned") : t("reportSent"));
        if (res.violation) setPartnerLeft(true);
      }
    } catch {
      setReportResult(t("reportError"));
    } finally {
      setReporting(false);
      setReportReason("");
    }
  };

  const showNetworkBar = network === "offline" || network === "connecting";

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col px-4 py-3">
      {showNetworkBar && (
        <div className="mb-2 flex justify-center animate-fade-up">
          <div
            className={
              "network-bar " +
              (network === "offline" ? "network-bar-offline" : "network-bar-connecting")
            }
          >
            {network === "offline" ? (
              <>
                <WifiOff className="h-3 w-3" />
                {t("noConnection")}
              </>
            ) : (
              <>
                <div className="ios-spinner ios-spinner-brand" />
                {t("connecting")}
              </>
            )}
          </div>
        </div>
      )}

      <header className="card-soft mb-3 flex items-center justify-between gap-2 px-4 py-2.5 animate-fade-up">
        <button onClick={leave} className="btn-pill btn-ghost-pill !p-2.5" aria-label={t("back")}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center">
          <div className="text-sm font-semibold tracking-wide">{t("stranger")}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (partnerLeft ? "bg-destructive" : "bg-[oklch(0.78_0.18_145)]")
              }
            />
            {partnerLeft ? t("partnerLeft") : t("connected")}
          </div>
        </div>
        <button
          onClick={() => {
            setReportResult(null);
            setReportOpen(true);
          }}
          className="btn-pill btn-ghost-pill !p-2.5"
          aria-label={t("report")}
        >
          <AlertTriangle className="h-5 w-5" />
        </button>
      </header>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t("reportTitle")}</DialogTitle>
            <DialogDescription>
              {t("reportHint")} {t("reportHint3")}
            </DialogDescription>
          </DialogHeader>
          {reportResult ? (
            <p className="text-sm">{reportResult}</p>
          ) : (
            <>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={t("reportReasonPlaceholder")}
                className="w-full resize-none rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={submitReport}
                disabled={reporting}
                className="btn-pill btn-brand w-full !rounded-2xl !py-3"
              >
                {reporting ? (
                  <>
                    <div className="ios-spinner" />
                    {t("reportChecking")}
                  </>
                ) : (
                  t("reportSend")
                )}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-1 py-2">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 animate-fade-up">
            <div
              className="ios-spinner ios-spinner-brand"
              style={{ width: "2rem", height: "2rem", borderWidth: "3px" }}
            />
            <span className="text-xs text-muted-foreground">{t("loadingMessages")}</span>
          </div>
        )}

        {messages.map((m) => {
          const mine = m.sender_id === userId;
          const deleted = Boolean(m.deleted_at);
          return (
            <div key={m.id} className={"flex flex-col " + (mine ? "items-end" : "items-start")}>
              <button
                type="button"
                onClick={() => {
                  if (mine && !deleted) setActionsFor(actionsFor === m.id ? null : m.id);
                }}
                className={
                  "msg-bubble max-w-[78%] text-left rounded-full px-4 py-2.5 text-sm leading-snug transition-[transform,opacity] duration-300 " +
                  (m.pending ? "opacity-60 " : "opacity-100 ") +
                  (deleted
                    ? "border border-dashed border-border bg-transparent italic text-muted-foreground"
                    : mine
                      ? "bg-[var(--brand)] text-[var(--brand-foreground)] shadow-[0_8px_24px_-12px_var(--brand-glow)]"
                      : "bg-card text-foreground border border-border")
                }
              >
                {deleted ? t("messageDeleted") : m.content}
              </button>

              <div className="mt-0.5 flex items-center gap-1 px-3 text-[10px] text-muted-foreground">
                {m.edited_at && !deleted && <span>{t("edited")}</span>}
                {mine && !deleted && !m.pending && (
                  m.read_at ? (
                    <CheckCheck className="h-3 w-3 text-[var(--brand)]" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )
                )}
              </div>

              {actionsFor === m.id && mine && !deleted && (
                <div className="mb-1 flex gap-2 animate-fade-up">
                  <button
                    onClick={() => startEdit(m)}
                    className="btn-pill btn-ghost-pill !px-3 !py-1.5 text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("edit")}
                  </button>
                  <button
                    onClick={() => removeMessage(m.id)}
                    className="btn-pill btn-ghost-pill !px-3 !py-1.5 text-xs text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("deleteMsg")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {partnerLeft && (
          <div className="py-6 text-center text-sm text-muted-foreground animate-fade-up">
            {t("partnerLeft")}
          </div>
        )}
      </div>

      {partnerLeft ? (
        <button onClick={() => navigate({ to: "/" })} className="btn-pill btn-brand mt-3 w-full">
          {t("newChat")}
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="card-soft mt-3 flex items-center gap-2 p-2 transition-all duration-300"
        >
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setInput("");
              }}
              className="btn-pill btn-ghost-pill !p-2"
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={editingId ? t("edit") : t("typeMessage")}
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn-pill btn-brand !p-3"
            aria-label={editingId ? t("save") : t("send")}
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      )}
    </main>
  );
}
