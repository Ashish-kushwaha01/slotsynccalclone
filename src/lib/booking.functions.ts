import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { computeAvailableSlots, type BusyInterval } from "./slots";

// Public server functions used by the invitee booking flow.
// No auth middleware — anyone can call. Use supabaseAdmin to bypass RLS
// (bookings insert has no anon policy by design).

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// --- Fetch host public profile + one event type by slug ---
export const getPublicEventType = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ username: z.string(), slug: z.string() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url, timezone")
      .eq("username", data.username)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) return null;
    const { data: et, error: etErr } = await supabaseAdmin
      .from("event_types")
      .select("*")
      .eq("user_id", profile.id)
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (etErr) throw new Error(etErr.message);
    if (!et) return null;
    return { profile, eventType: et };
  });

// --- Fetch host profile + all active event types ---
export const getPublicHostPage = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ username: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url, timezone")
      .eq("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) return null;
    const { data: eventTypes, error: etErr } = await supabaseAdmin
      .from("event_types")
      .select("id, slug, title, description, duration_min, color, location")
      .eq("user_id", profile.id)
      .eq("active", true)
      .order("duration_min");
    if (etErr) throw new Error(etErr.message);
    return { profile, eventTypes: eventTypes ?? [] };
  });

// --- Compute slots for a given day ---
export const getAvailableSlots = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ eventTypeId: z.string().uuid(), date: dateSchema }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: et, error: etErr } = await supabaseAdmin
      .from("event_types")
      .select("*, profiles!inner(timezone)")
      .eq("id", data.eventTypeId)
      .eq("active", true)
      .maybeSingle();
    if (etErr) throw new Error(etErr.message);
    if (!et) return { slots: [] as string[] };
    const hostTimezone = (et.profiles as { timezone: string }).timezone;

    const [{ data: rules }, { data: overrides }, { data: existing }] = await Promise.all([
      supabaseAdmin.from("availability_rules").select("*").eq("user_id", et.user_id),
      supabaseAdmin.from("date_overrides").select("*").eq("user_id", et.user_id),
      supabaseAdmin
        .from("bookings")
        .select("start_at, end_at")
        .eq("host_user_id", et.user_id)
        .eq("status", "confirmed")
        .gte("start_at", new Date(data.date + "T00:00:00Z").toISOString())
        .lte("start_at", new Date(data.date + "T23:59:59Z").toISOString()),
    ]);

    const busy: BusyInterval[] = (existing ?? []).map((b) => ({
      start: new Date(b.start_at),
      end: new Date(b.end_at),
    }));

    // TODO Phase 2 hook: also merge Google Calendar busy intervals here when
    // the host has a google_calendar_connections row.

    const slots = computeAvailableSlots({
      date: data.date,
      hostTimezone,
      durationMin: et.duration_min,
      bufferBeforeMin: et.buffer_before_min,
      bufferAfterMin: et.buffer_after_min,
      minNoticeMin: et.min_notice_min,
      maxAdvanceDays: et.max_advance_days,
      rules: rules ?? [],
      overrides: overrides ?? [],
      busy,
    });
    return { slots: slots.map((d) => d.toISOString()) };
  });

// --- Create a booking ---
const bookSchema = z.object({
  eventTypeId: z.string().uuid(),
  startAtIso: z.string().datetime(),
  inviteeName: z.string().min(1).max(120),
  inviteeEmail: z.string().email(),
  inviteeNotes: z.string().max(2000).optional().nullable(),
  inviteeTimezone: z.string().max(64).default("UTC"),
});

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => bookSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: et, error: etErr } = await supabaseAdmin
      .from("event_types")
      .select("*")
      .eq("id", data.eventTypeId)
      .eq("active", true)
      .maybeSingle();
    if (etErr) throw new Error(etErr.message);
    if (!et) throw new Error("Event type not found");

    const startAt = new Date(data.startAtIso);
    const endAt = new Date(startAt.getTime() + et.duration_min * 60_000);

    // Conflict check
    const { data: conflicts } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("host_user_id", et.user_id)
      .eq("status", "confirmed")
      .lt("start_at", endAt.toISOString())
      .gt("end_at", startAt.toISOString());
    if (conflicts && conflicts.length > 0) {
      throw new Error("That time was just taken. Please pick another slot.");
    }

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        event_type_id: et.id,
        host_user_id: et.user_id,
        invitee_name: data.inviteeName,
        invitee_email: data.inviteeEmail,
        invitee_notes: data.inviteeNotes ?? null,
        invitee_timezone: data.inviteeTimezone,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
      })
      .select("id, cancel_token, start_at, end_at")
      .single();
    if (error) throw new Error(error.message);

    // Fire webhook (best-effort)
    const { logAndDispatch } = await import("./webhook.server");
    await logAndDispatch({
      event: "booking.confirmed",
      bookingId: booking.id,
      data: {
        hostUserId: et.user_id,
        eventTypeId: et.id,
        eventTitle: et.title,
        inviteeName: data.inviteeName,
        inviteeEmail: data.inviteeEmail,
        inviteeNotes: data.inviteeNotes,
        startAt: booking.start_at,
        endAt: booking.end_at,
        cancelToken: booking.cancel_token,
      },
    });

    return { bookingId: booking.id, cancelToken: booking.cancel_token };
  });

// --- Look up booking by cancel token (invitee page) ---
export const getBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => z.object({ token: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("*, event_types(title, duration_min), profiles!bookings_host_user_id_fkey(display_name, username, timezone)")
      .eq("cancel_token", data.token)
      .maybeSingle();
    return booking ?? null;
  });

// --- Cancel booking by token ---
export const cancelBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({ token: z.string(), reason: z.string().max(500).optional() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled", cancel_reason: data.reason ?? null })
      .eq("cancel_token", data.token)
      .eq("status", "confirmed")
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) throw new Error("Booking not found or already cancelled");

    const { logAndDispatch } = await import("./webhook.server");
    await logAndDispatch({
      event: "booking.cancelled",
      bookingId: booking.id,
      data: {
        hostUserId: booking.host_user_id,
        inviteeEmail: booking.invitee_email,
        startAt: booking.start_at,
        reason: data.reason,
      },
    });
    return { ok: true };
  });
