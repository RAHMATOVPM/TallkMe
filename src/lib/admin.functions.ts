import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CodeInput = z.object({ code: z.string().min(1).max(200) });

function checkCode(code: string) {
  const expected = process.env["TALKME_ADMIN_CODE"];
  if (!expected) return false;
  if (code.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < code.length; i++) diff |= code.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CodeInput.parse(input))
  .handler(async ({ data }) => ({ ok: checkCode(data.code) }));

export const adminListReports = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    CodeInput.extend({ status: z.enum(["pending", "banned", "dismissed"]).default("pending") }).parse(
      input,
    ),
  )
  .handler(async ({ data }) => {
    if (!checkCode(data.code)) return { ok: false as const, error: "bad_code" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: reports } = await supabaseAdmin
      .from("user_reports")
      .select("id, reporter_id, reported_id, room_id, reason, created_at, status, ai_violation, ai_category")
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .limit(100);

    const list = reports ?? [];
    const reportedIds = [...new Set(list.map((r) => r.reported_id))];

    let activeBans: Record<string, string> = {};
    if (reportedIds.length > 0) {
      const { data: bans } = await supabaseAdmin
        .from("user_bans")
        .select("user_id, banned_until")
        .in("user_id", reportedIds)
        .gt("banned_until", new Date().toISOString());
      for (const b of bans ?? []) activeBans[b.user_id] = b.banned_until;
    }

    return {
      ok: true as const,
      reports: list.map((r) => ({ ...r, bannedUntil: activeBans[r.reported_id] ?? null })),
    };
  });

export const adminGetTranscript = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CodeInput.extend({ reportId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    if (!checkCode(data.code)) return { ok: false as const, error: "bad_code" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: report } = await supabaseAdmin
      .from("user_reports")
      .select("id, reporter_id, reported_id, room_id, reason, created_at, status, ai_violation, ai_category")
      .eq("id", data.reportId)
      .maybeSingle();

    if (!report) return { ok: false as const, error: "not_found" };
    if (!report.room_id) return { ok: true as const, report, messages: [] };

    const { data: msgs } = await supabaseAdmin
      .from("messages")
      .select("id, sender_id, content, created_at, deleted_at")
      .eq("room_id", report.room_id)
      .order("created_at", { ascending: true })
      .limit(300);

    return {
      ok: true as const,
      report,
      messages: (msgs ?? []).map((m) => ({
        id: m.id,
        content: m.deleted_at ? "" : m.content,
        deleted: Boolean(m.deleted_at),
        createdAt: m.created_at,
        role: m.sender_id === report.reported_id ? ("reported" as const) : ("reporter" as const),
      })),
    };
  });

export const adminDecide = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    CodeInput.extend({
      reportId: z.string().uuid(),
      action: z.enum(["ban", "dismiss"]),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!checkCode(data.code)) return { ok: false as const, error: "bad_code" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: report } = await supabaseAdmin
      .from("user_reports")
      .select("id, reported_id, room_id, reason")
      .eq("id", data.reportId)
      .maybeSingle();
    if (!report) return { ok: false as const, error: "not_found" };

    if (data.action === "ban") {
      const bannedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabaseAdmin.from("user_bans").insert({
        user_id: report.reported_id,
        reason: report.reason || "admin_decision",
        banned_until: bannedUntil,
      });
      if (report.room_id) {
        await supabaseAdmin.from("chat_rooms").update({ active: false }).eq("id", report.room_id);
      }
      await supabaseAdmin.from("waiting_queue").delete().eq("user_id", report.reported_id);
    }

    await supabaseAdmin
      .from("user_reports")
      .update({
        status: data.action === "ban" ? "banned" : "dismissed",
        handled_at: new Date().toISOString(),
      })
      .eq("id", data.reportId);

    return { ok: true as const };
  });
