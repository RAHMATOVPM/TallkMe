import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ReportInput = z.object({
  roomId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const SYSTEM_PROMPT = `You are a moderation system for an anonymous chat app.
You receive a transcript of a conversation between "REPORTED" and "REPORTER".
Judge ONLY the messages written by REPORTED.
Violations: profanity/obscene language, racism or any hate speech, sexual harassment,
threats or violence, insults, scam/spam, sharing illegal content, sexual content involving minors.
Answer with JSON only: {"violation": true|false, "category": "short label", "explanation": "one short sentence"}.`;

export const reportChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReportInput.parse(input))
  .handler(async ({ data: input, context }) => {
    const data = { ...input, reporterId: context.userId };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: room } = await supabaseAdmin
      .from("chat_rooms")
      .select("id, user_a, user_b")
      .eq("id", data.roomId)
      .maybeSingle();

    if (!room) return { ok: false as const, error: "room_not_found" };
    if (room.user_a !== data.reporterId && room.user_b !== data.reporterId) {
      return { ok: false as const, error: "not_a_participant" };
    }
    const reportedId = room.user_a === data.reporterId ? room.user_b : room.user_a;

    const { data: msgs } = await supabaseAdmin
      .from("messages")
      .select("sender_id, content, created_at")
      .eq("room_id", data.roomId)
      .order("created_at", { ascending: true })
      .limit(200);

    const transcript = (msgs ?? [])
      .map((m) => `${m.sender_id === reportedId ? "REPORTED" : "REPORTER"}: ${m.content}`)
      .join("\n")
      .slice(-8000);

    let violation = false;
    let category = "rules_violation";

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (apiKey && transcript.trim().length > 0) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: transcript },
            ],
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const raw = json.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "")) as {
            violation?: boolean;
            category?: string;
          };
          violation = parsed.violation === true;
          if (parsed.category) category = String(parsed.category).slice(0, 100);
        } else {
          console.error("[moderation] gateway error", res.status, await res.text());
        }
      } catch (e) {
        console.error("[moderation] failed", e);
      }
    }

    // No auto-ban: the report goes to the admin queue for a human decision.
    await supabaseAdmin.from("user_reports").insert({
      reporter_id: data.reporterId,
      reported_id: reportedId,
      room_id: data.roomId,
      reason: data.reason?.trim() || "",
      status: "pending",
      ai_violation: violation,
      ai_category: category,
    });

    return {
      ok: true as const,
      violation: false,
      category,
    };
  });

