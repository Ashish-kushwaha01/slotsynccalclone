import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// -------- Profile --------
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const profileUpdateSchema = z.object({
  username: z.string().regex(/^[a-z0-9][a-z0-9-]{2,39}$/),
  display_name: z.string().min(1).max(80),
  bio: z.string().max(500).nullable().optional(),
  timezone: z.string().min(1).max(64),
  avatar_url: z.string().max(500).nullable().optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => profileUpdateSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Event types --------
export const listMyEventTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("event_types")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const eventTypeInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,49}$/),
  title: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
  duration_min: z.number().int().min(5).max(480),
  buffer_before_min: z.number().int().min(0).max(120),
  buffer_after_min: z.number().int().min(0).max(120),
  min_notice_min: z.number().int().min(0).max(10080),
  max_advance_days: z.number().int().min(1).max(365),
  location: z.string().max(200).nullable().optional(),
  active: z.boolean(),
  color: z.string().max(20).optional(),
});

export const upsertEventType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => eventTypeInputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId };
    if (data.id) {
      const { error } = await context.supabase
        .from("event_types")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("event_types")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteEventType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("event_types")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Availability --------
export const getMyAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [rules, overrides] = await Promise.all([
      context.supabase
        .from("availability_rules")
        .select("*")
        .eq("user_id", context.userId)
        .order("day_of_week"),
      context.supabase
        .from("date_overrides")
        .select("*")
        .eq("user_id", context.userId)
        .order("override_date"),
    ]);
    if (rules.error) throw new Error(rules.error.message);
    if (overrides.error) throw new Error(overrides.error.message);
    return { rules: rules.data ?? [], overrides: overrides.data ?? [] };
  });

const availabilityInputSchema = z.object({
  rules: z.array(
    z.object({
      day_of_week: z.number().int().min(0).max(6),
      start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    }),
  ),
  timezone: z.string().min(1).max(64).optional(),
});

export const replaceAvailabilityRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => availabilityInputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { error: delErr } = await context.supabase
      .from("availability_rules")
      .delete()
      .eq("user_id", context.userId);
    if (delErr) throw new Error(delErr.message);
    if (data.timezone) {
      const { error: tzErr } = await context.supabase
        .from("profiles")
        .update({ timezone: data.timezone })
        .eq("id", context.userId);
      if (tzErr) throw new Error(tzErr.message);
    }
    if (data.rules.length > 0) {
      const { error } = await context.supabase
        .from("availability_rules")
        .insert(data.rules.map((r) => ({ ...r, user_id: context.userId })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// -------- Bookings --------
export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("bookings")
      .select("*, meeting_url, event_types(title, slug, color, location)")
      .eq("host_user_id", context.userId)
      .order("start_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cancelMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ bookingId: z.string().uuid(), reason: z.string().max(500).optional() })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { data: booking, error } = await context.supabase
      .from("bookings")
      .update({ status: "cancelled", cancel_reason: data.reason ?? null })
      .eq("id", data.bookingId)
      .eq("host_user_id", context.userId)
      .eq("status", "confirmed")
      .select("id, host_user_id, invitee_email, start_at")
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
