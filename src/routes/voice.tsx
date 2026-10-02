import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Settings as SettingsIcon, Phone, Sparkles, PhoneOff, Mic, MicOff } from "lucide-react";
import { useApp, type Gender } from "@/lib/app-context";
import { useOnlineCount } from "@/lib/use-online";
import { BottomNav } from "@/components/bottom-nav";
import { feedback } from "@/lib/feedback";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const Route = createFileRoute("/voice")({
  head: () => ({
    meta: [
      { title: "TalkMe — Voice call" },
      { name: "description", content: "Anonymous voice calls with new people." },
    ],
  }),
  component: VoicePage,
});

type CallStatus = "idle" | "searching" | "connecting" | "in-call" | "ended";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function VoicePage() {
  const { t, profile, userId, brand } = useApp();
  const online = useOnlineCount(userId);

  const [gender, setGender] = useState<Gender>(profile?.gender ?? "male");
  const [age, setAge] = useState<number>(profile?.age ?? 21);
  const [wantGender, setWantGender] = useState<Gender>((profile?.wantGender as Gender) ?? "female");
  const [ageRange, setAgeRange] = useState<[number, number]>([
    profile?.wantAgeMin ?? 18,
    profile?.wantAgeMax ?? 20,
  ]);

  const [status, setStatus] = useState<CallStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const chanRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ageLabel = useMemo(
    () => (age === 30 ? "30+" : age === 18 ? "18–20" : "21–25"),
    [age],
  );

  const cleanup = async (playLeave: boolean) => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;

    if (chanRef.current) {
      try {
        await chanRef.current.send({ type: "broadcast", event: "bye", payload: { from: userId } });
      } catch {}
      supabase.removeChannel(chanRef.current);
      chanRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((tr) => tr.stop());
      localStreamRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
    }
    if (roomIdRef.current) {
      try {
        await supabase.from("chat_rooms").update({ active: false }).eq("id", roomIdRef.current);
      } catch {}
      try {
        await supabase.from("waiting_queue").delete().eq("user_id", userId);
      } catch {}
      roomIdRef.current = null;
    }
    if (playLeave) feedback("leave");
    setSeconds(0);
  };

  useEffect(() => {
    return () => {
      void cleanup(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupPeer = async (roomId: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Local mic
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (ev) => {
      if (audioElRef.current) {
        audioElRef.current.srcObject = ev.streams[0];
        void audioElRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "connected") {
        setStatus("in-call");
        feedback("match");
        if (!timerRef.current) {
          timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        }
      } else if (st === "failed" || st === "disconnected" || st === "closed") {
        void cleanup(true);
        setStatus("ended");
      }
    };

    const chan = supabase.channel(`voice-${roomId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    chanRef.current = chan;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        void chan.send({
          type: "broadcast",
          event: "ice",
          payload: { from: userId, candidate: ev.candidate.toJSON() },
        });
      }
    };

    chan.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (isInitiator || !pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      await chan.send({ type: "broadcast", event: "answer", payload: { from: userId, sdp: answer } });
    });

    chan.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (!isInitiator || !pcRef.current) return;
      if (pcRef.current.currentRemoteDescription) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    });

    chan.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (!pcRef.current || payload.from === userId) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (e) {
        console.warn("ice add failed", e);
      }
    });

    chan.on("broadcast", { event: "bye" }, () => {
      void cleanup(true);
      setStatus("ended");
    });

    chan.on("broadcast", { event: "ready" }, async ({ payload }) => {
      // Peer signaled it's ready. Initiator sends offer.
      if (isInitiator && pcRef.current && payload.from !== userId) {
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        await chan.send({ type: "broadcast", event: "offer", payload: { from: userId, sdp: offer } });
      }
    });

    await new Promise<void>((resolve) => {
      chan.subscribe((s) => {
        if (s === "SUBSCRIBED") resolve();
      });
    });

    // Announce readiness. Both sides send; initiator will react to peer's ready.
    await chan.send({ type: "broadcast", event: "ready", payload: { from: userId } });

    if (isInitiator) {
      // Also send an offer immediately in case peer was ready before us
      setTimeout(async () => {
        if (!pcRef.current) return;
        if (pcRef.current.signalingState !== "stable") return;
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        await chan.send({ type: "broadcast", event: "offer", payload: { from: userId, sdp: offer } });
      }, 400);
    }
  };

  const startMatchmaking = async () => {
    setErrorMsg(null);
    setStatus("searching");

    const tryMatch = async () => {
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
        setErrorMsg(error.message.includes("USER_BANNED") ? t("banned24") : error.message);
        setStatus("idle");
        return true;
      }
      if (typeof data === "string" && data) {
        const roomId = data;
        roomIdRef.current = roomId;
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setStatus("connecting");
        // Determine initiator deterministically: fetch room, initiator is user_a
        const { data: room } = await supabase
          .from("chat_rooms")
          .select("user_a,user_b")
          .eq("id", roomId)
          .maybeSingle();
        const isInitiator = room ? room.user_a === userId : userId < "m";
        try {
          await setupPeer(roomId, isInitiator);
        } catch (e) {
          console.error(e);
          setErrorMsg((e as Error).message);
          await cleanup(false);
          setStatus("idle");
        }
        return true;
      }
      return false;
    };

    const done = await tryMatch();
    if (!done) {
      pollRef.current = setInterval(async () => {
        const { data } = await supabase.rpc("find_room_for_user", { p_user_id: userId });
        if (typeof data === "string" && data) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          roomIdRef.current = data;
          setStatus("connecting");
          const { data: room } = await supabase
            .from("chat_rooms")
            .select("user_a,user_b")
            .eq("id", data)
            .maybeSingle();
          const isInitiator = room ? room.user_a === userId : false;
          try {
            await setupPeer(data, isInitiator);
          } catch (e) {
            console.error(e);
            setErrorMsg((e as Error).message);
            await cleanup(false);
            setStatus("idle");
          }
        }
      }, 1500);
    }
  };

  const cancel = async () => {
    await cleanup(status === "in-call");
    setStatus("idle");
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((tr) => (tr.enabled = !next));
    setMuted(next);
    feedback("tap");
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const busy = status !== "idle" && status !== "ended";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-8">
      <audio ref={audioElRef} autoPlay playsInline />

      <header className="mb-6 flex items-center justify-between animate-fade-up">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand)] text-[var(--brand-foreground)] shadow-[0_10px_30px_-10px_var(--brand-glow)]">
            <Phone className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">TalkMe</span>
        </div>
        <Link to="/settings" className="btn-pill btn-ghost-pill !p-3" aria-label={t("settings")}>
          <SettingsIcon className="h-5 w-5" />
        </Link>
      </header>

      <section className="card-soft mb-6 flex items-center justify-between gap-3 px-5 py-4 animate-fade-up">
        <div className="flex items-center gap-3">
          <span className="pulse-dot" />
          <div>
            <div className="text-2xl font-bold tabular-nums">{online}</div>
            <div className="text-xs text-muted-foreground">{t("online")}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground capitalize">{brand}</div>
      </section>

      {busy ? (
        <div className="card-soft flex flex-col items-center gap-5 p-8 animate-fade-up">
          <div className="relative grid h-24 w-24 place-items-center">
            <div className="absolute inset-0 animate-float rounded-full bg-[var(--brand)]/20 blur-2xl" />
            <div className="grid h-20 w-20 place-items-center rounded-full bg-[var(--brand)] text-[var(--brand-foreground)] shadow-[0_20px_50px_-10px_var(--brand-glow)]">
              <Phone className="h-9 w-9" />
            </div>
          </div>

          {status === "in-call" ? (
            <div className="text-2xl font-semibold tabular-nums">{mm}:{ss}</div>
          ) : (
            <div className="h-1 w-40 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-full animate-shimmer" />
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {status === "searching"
              ? t("voiceSearching")
              : status === "connecting"
                ? t("connecting")
                : t("connected")}
          </p>

          <div className="flex w-full gap-2">
            {status === "in-call" && (
              <button
                onClick={toggleMute}
                className={"btn-pill flex-1 " + (muted ? "btn-brand" : "btn-ghost-pill")}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                {muted ? "Unmute" : "Mute"}
              </button>
            )}
            <button onClick={cancel} className="btn-pill btn-ghost-pill flex-1">
              <PhoneOff className="h-5 w-5" />
              {status === "in-call" ? t("leave") : t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="card-soft p-5 animate-fade-up">
          <h2 className="mb-1 text-lg font-semibold">{t("voiceTitle")}</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            <Sparkles className="mr-1 inline h-4 w-4" />
            {t("voiceHint")}
          </p>

          {errorMsg && (
            <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
              {errorMsg}
            </div>
          )}

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

          <Field label={`${t("yourAge")}: ${ageLabel}`}>
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

          <div className="my-4 h-px bg-border" />

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

          <Field
            label={`${t("ageRange")}: ${ageRange[0] === 30 ? "30+" : `${ageRange[0]}–${ageRange[1]}`}`}
          >
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

          <button
            onClick={startMatchmaking}
            className="btn-pill btn-brand mt-5 w-full text-base"
          >
            <Phone className="h-5 w-5" />
            {t("startCall")}
          </button>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
            className={"btn-pill flex-1 text-sm " + (active ? "btn-brand" : "btn-ghost-pill")}
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
              "btn-pill !px-4 !py-2 text-sm " + (active ? "btn-brand" : "btn-ghost-pill")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
