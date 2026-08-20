// Server-only n8n outbound webhook helper. HMAC-signed with N8N_WEBHOOK_SECRET.
import { createHmac } from "node:crypto";

export interface WebhookEvent {
  event: "booking.confirmed" | "booking.cancelled" | "booking.reminder";
  bookingId: string;
  data: Record<string, unknown>;
}

export async function dispatchN8nWebhook(evt: WebhookEvent): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!url) {
    return { ok: false, error: "N8N_WEBHOOK_URL not configured" };
  }
  if (!secret) {
    return { ok: false, error: "N8N_WEBHOOK_SECRET not configured" };
  }
  const body = JSON.stringify({ ...evt, sentAt: new Date().toISOString() });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Valence-Signature": signature,
        "X-Valence-Event": evt.event,
      },
      body,
    });
    if (!res.ok) {
      return { ok: false, error: `n8n returned ${res.status}: ${await res.text().catch(() => "")}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

export async function logAndDispatch(
  evt: WebhookEvent,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: delivery } = await supabaseAdmin
    .from("webhook_deliveries")
    .insert({
      booking_id: evt.bookingId,
      event_type: evt.event,
      payload: JSON.parse(JSON.stringify(evt)),
      status: "pending",
      attempts: 0,
    })
    .select()
    .single();

  const result = await dispatchN8nWebhook(evt);
  if (delivery) {
    await supabaseAdmin
      .from("webhook_deliveries")
      .update({
        status: result.ok ? "delivered" : "failed",
        attempts: 1,
        last_error: result.error ?? null,
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
  }
}

