import { computeAvailableSlots, type BusyInterval, zonedDateToUtc } from "@/lib/slots";
import { createGoogleCalendarEvent, decryptRefreshToken, fetchGoogleBusyIntervals, getAccessTokenFromRefresh } from "@/lib/google-calendar.server";
import { sendBookingConfirmationEmail, sendHostBookingNotificationEmail } from "@/lib/email.server";

export type BookingCoreParams = {
  eventTypeId: string;
  startAtIso: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeNotes?: string | null;
  inviteeTimezone: string;
  source: "email" | "api" | "booking-page";
};

export async function createBookingCore(params: BookingCoreParams): Promise<{
  bookingId: string;
  cancelToken: string;
  rescheduleToken: string;
  meetingUrl: string | null;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: eventType, error: etErr } = await supabaseAdmin
    .from("event_types")
    .select("*")
    .eq("id", params.eventTypeId)
    .eq("active", true)
    .maybeSingle();
  if (etErr) throw new Error(etErr.message);
  if (!eventType) throw new Error("Event type not found");

  const startAt = new Date(params.startAtIso);
  if (Number.isNaN(startAt.getTime())) throw new Error("Invalid start time");
  if (startAt.getTime() <= Date.now()) throw new Error("Meeting time must be in the future");

  const endAt = new Date(startAt.getTime() + eventType.duration_min * 60_000);

  const { data: hostProfile } = await supabaseAdmin
    .from("profiles")
    .select("timezone, display_name")
    .eq("id", eventType.user_id)
    .maybeSingle();
  const hostTimezone = hostProfile?.timezone ?? "UTC";
  const locationLabel = eventType.location ?? "No location";
  const isGoogleMeet = /google/i.test(locationLabel) && /meet/i.test(locationLabel);
  const linkFromLocation = /^https?:\/\//i.test(locationLabel) ? locationLabel : undefined;

  const availability = await isSlotAvailable({
    eventType,
    startAt,
    endAt,
    hostTimezone,
  });
  if (!availability.ok) {
    throw new Error(availability.error);
  }

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      event_type_id: eventType.id,
      host_user_id: eventType.user_id,
      invitee_name: params.inviteeName,
      invitee_email: params.inviteeEmail,
      invitee_notes: params.inviteeNotes ?? null,
      invitee_timezone: params.inviteeTimezone,
      meeting_url: linkFromLocation ?? null,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
    })
    .select("id, cancel_token, start_at, end_at")
    .single();
  if (error) throw new Error(error.message);

  const cancelToken = booking.cancel_token;
  await supabaseAdmin.from("cancel_tokens").insert({
    booking_id: booking.id,
    token: cancelToken,
  });

  const { data: reschedule } = await supabaseAdmin
    .from("reschedule_tokens")
    .insert({
      booking_id: booking.id,
    })
    .select("token")
    .single();
  const rescheduleToken = reschedule?.token ?? "";

  let meetingUrl: string | null = linkFromLocation ?? null;
  const googleAccess = await getGoogleCalendarAccessToken({
    supabaseAdmin,
    userId: eventType.user_id,
  });

  if (googleAccess) {
    try {
      const description = [
        `Invitee: ${params.inviteeName} <${params.inviteeEmail}>`,
        params.inviteeNotes ? `Notes: ${params.inviteeNotes}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const eventResult = await createGoogleCalendarEvent({
        accessToken: googleAccess.accessToken,
        calendarId: googleAccess.calendarId,
        summary: eventType.title,
        description,
        startIso: startAt.toISOString(),
        endIso: endAt.toISOString(),
        timeZone: hostTimezone,
        createMeet: isGoogleMeet,
      });

      meetingUrl = eventResult.meetingUrl ?? meetingUrl;
      if (meetingUrl) {
        await supabaseAdmin.from("bookings").update({ meeting_url: meetingUrl }).eq("id", booking.id);
        await supabaseAdmin.from("meeting_links").insert({
          booking_id: booking.id,
          provider: isGoogleMeet ? "google_meet" : "manual",
          url: meetingUrl,
        });
      }
    } catch (err) {
      console.warn("Google Calendar event create failed", err);
    }
  }

  await createReminderJobs({
    bookingId: booking.id,
    startAt: booking.start_at,
  });

  await sendBookingConfirmationEmail({
    toEmail: params.inviteeEmail,
    toName: params.inviteeName,
    hostName: hostProfile?.display_name ?? "Host",
    inviteeName: params.inviteeName,
    inviteeEmail: params.inviteeEmail,
    inviteeNotes: params.inviteeNotes,
    eventTitle: eventType.title,
    startAtIso: booking.start_at,
    endAtIso: booking.end_at,
    timeZone: params.inviteeTimezone || hostTimezone,
    locationLabel,
    meetingUrl: meetingUrl ?? undefined,
    cancelToken,
    rescheduleToken,
  });

  let hostEmail: string | null = null;
  try {
    const { data: hostUser } = await supabaseAdmin.auth.admin.getUserById(eventType.user_id);
    hostEmail = hostUser?.user?.email ?? null;
  } catch (err) {
    console.warn("Host email lookup failed", err);
  }

  if (hostEmail) {
    await sendHostBookingNotificationEmail({
      toEmail: hostEmail,
      toName: hostProfile?.display_name ?? "Host",
      hostName: hostProfile?.display_name ?? "Host",
      inviteeName: params.inviteeName,
      inviteeEmail: params.inviteeEmail,
      inviteeNotes: params.inviteeNotes,
      eventTitle: eventType.title,
      startAtIso: booking.start_at,
      endAtIso: booking.end_at,
      timeZone: hostTimezone,
      locationLabel,
      meetingUrl: meetingUrl ?? undefined,
    });
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor: params.source,
    action: "booking.created",
    target_type: "booking",
    target_id: booking.id,
    metadata: {
      eventTypeId: eventType.id,
      inviteeEmail: params.inviteeEmail,
      source: params.source,
    },
  });

  return { bookingId: booking.id, cancelToken, rescheduleToken, meetingUrl };
}

export async function cancelBookingCore(params: {
  bookingId: string;
  reason?: string | null;
  source: "email" | "api" | "booking-page";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled", cancel_reason: params.reason ?? null })
    .eq("id", params.bookingId)
    .eq("status", "confirmed")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!booking) return { ok: false, error: "Booking not found" };

  await cancelReminderJobs({ bookingId: booking.id });

  await supabaseAdmin.from("audit_logs").insert({
    actor: params.source,
    action: "booking.cancelled",
    target_type: "booking",
    target_id: booking.id,
    metadata: { reason: params.reason ?? null },
  });

  return { ok: true };
}

export async function rescheduleBookingCore(params: {
  bookingId: string;
  newStartIso: string;
  inviteeTimezone: string;
  source: "email" | "api";
}): Promise<{ bookingId: string; cancelToken: string; rescheduleToken: string; meetingUrl: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", params.bookingId)
    .eq("status", "confirmed")
    .maybeSingle();
  if (!existing) throw new Error("Booking not found");

  await cancelBookingCore({
    bookingId: existing.id,
    reason: "rescheduled",
    source: params.source,
  });

  return createBookingCore({
    eventTypeId: existing.event_type_id,
    startAtIso: params.newStartIso,
    inviteeName: existing.invitee_name,
    inviteeEmail: existing.invitee_email,
    inviteeNotes: existing.invitee_notes,
    inviteeTimezone: params.inviteeTimezone,
    source: params.source,
  });
}

export async function findNearestAvailableSlot(params: {
  eventTypeId: string;
  startAt: Date;
  maxDaysAhead?: number;
}): Promise<Date | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: eventType } = await supabaseAdmin
    .from("event_types")
    .select("*")
    .eq("id", params.eventTypeId)
    .eq("active", true)
    .maybeSingle();
  if (!eventType) return null;

  const { data: hostProfile } = await supabaseAdmin
    .from("profiles")
    .select("timezone")
    .eq("id", eventType.user_id)
    .maybeSingle();
  const hostTimezone = hostProfile?.timezone ?? "UTC";

  const { data: rules } = await supabaseAdmin
    .from("availability_rules")
    .select("*")
    .eq("user_id", eventType.user_id);
  const { data: overrides } = await supabaseAdmin
    .from("date_overrides")
    .select("*")
    .eq("user_id", eventType.user_id);

  const maxDays = params.maxDaysAhead ?? eventType.max_advance_days;
  const startDate = formatYmdInZone(params.startAt, hostTimezone);

  for (let offset = 0; offset <= maxDays; offset += 1) {
    const dateYmd = addDaysYmd(startDate, offset);
    const busy = await getBusyIntervals({
      supabaseAdmin,
      userId: eventType.user_id,
      dateYmd,
      hostTimezone,
    });

    const slots = computeAvailableSlots({
      date: dateYmd,
      hostTimezone,
      durationMin: eventType.duration_min,
      slotStepMin: 30,
      bufferBeforeMin: eventType.buffer_before_min,
      bufferAfterMin: eventType.buffer_after_min,
      minNoticeMin: eventType.min_notice_min,
      maxAdvanceDays: eventType.max_advance_days,
      rules: rules ?? [],
      overrides: overrides ?? [],
      busy,
    });

    for (const slot of slots) {
      if (slot.getTime() >= params.startAt.getTime()) {
        return slot;
      }
    }
  }

  return null;
}

async function isSlotAvailable(params: {
  eventType: any;
  startAt: Date;
  endAt: Date;
  hostTimezone: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const dateYmd = formatYmdInZone(params.startAt, params.hostTimezone);
  const hostTodayYmd = formatYmdInZone(new Date(), params.hostTimezone);
  const minNoticeMin = dateYmd === hostTodayYmd ? 0 : params.eventType.min_notice_min;

  const [{ data: rules }, { data: overrides }] = await Promise.all([
    supabaseAdmin.from("availability_rules").select("*").eq("user_id", params.eventType.user_id),
    supabaseAdmin.from("date_overrides").select("*").eq("user_id", params.eventType.user_id),
  ]);

  const busy = await getBusyIntervals({
    supabaseAdmin,
    userId: params.eventType.user_id,
    dateYmd,
    hostTimezone: params.hostTimezone,
  });

  const allowedSlots = computeAvailableSlots({
    date: dateYmd,
    hostTimezone: params.hostTimezone,
    durationMin: params.eventType.duration_min,
    slotStepMin: 30,
    bufferBeforeMin: params.eventType.buffer_before_min,
    bufferAfterMin: params.eventType.buffer_after_min,
    minNoticeMin,
    maxAdvanceDays: params.eventType.max_advance_days,
    rules: rules ?? [],
    overrides: overrides ?? [],
    busy,
  });

  const allowed = allowedSlots.some((slot) => slot.getTime() === params.startAt.getTime());
  if (!allowed) {
    return { ok: false, error: "That time is no longer available." };
  }

  const { data: conflicts } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("host_user_id", params.eventType.user_id)
    .eq("status", "confirmed")
    .lt("start_at", params.endAt.toISOString())
    .gt("end_at", params.startAt.toISOString());
  if (conflicts && conflicts.length > 0) {
    return { ok: false, error: "That time was just taken." };
  }

  const googleBusy = await getGoogleCalendarBusyIntervals({
    supabaseAdmin,
    userId: params.eventType.user_id,
    timeMinIso: params.startAt.toISOString(),
    timeMaxIso: params.endAt.toISOString(),
  });
  const googleConflict = googleBusy.some((b) => b.start < params.endAt && b.end > params.startAt);
  if (googleConflict) {
    return { ok: false, error: "That time is busy on the host's calendar." };
  }

  return { ok: true };
}

async function getGoogleCalendarAccessToken(params: {
  supabaseAdmin: any;
  userId: string;
}): Promise<{ accessToken: string; calendarId?: string } | null> {
  const { data: connection } = await params.supabaseAdmin
    .from("google_calendar_connections")
    .select("connection_key_ciphertext, calendar_id")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (!connection?.connection_key_ciphertext) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const refreshToken = decryptRefreshToken(connection.connection_key_ciphertext);
  const accessToken = await getAccessTokenFromRefresh({
    clientId,
    clientSecret,
    refreshToken,
  });

  return { accessToken, calendarId: connection.calendar_id ?? "primary" };
}

async function getGoogleCalendarBusyIntervals(params: {
  supabaseAdmin: any;
  userId: string;
  timeMinIso: string;
  timeMaxIso: string;
}): Promise<BusyInterval[]> {
  try {
    const google = await getGoogleCalendarAccessToken({
      supabaseAdmin: params.supabaseAdmin,
      userId: params.userId,
    });
    if (!google) return [];

    const busy = await fetchGoogleBusyIntervals({
      accessToken: google.accessToken,
      calendarId: google.calendarId,
      timeMinIso: params.timeMinIso,
      timeMaxIso: params.timeMaxIso,
    });

    return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  } catch (err) {
    console.warn("Google Calendar freebusy failed", err);
    return [];
  }
}

async function getBusyIntervals(params: {
  supabaseAdmin: any;
  userId: string;
  dateYmd: string;
  hostTimezone: string;
}): Promise<BusyInterval[]> {
  const startUtc = zonedDateToUtc(params.dateYmd, 0, params.hostTimezone);
  const endUtc = zonedDateToUtc(addDaysYmd(params.dateYmd, 1), 0, params.hostTimezone);

  const { data: existing } = await params.supabaseAdmin
    .from("bookings")
    .select("start_at, end_at")
    .eq("host_user_id", params.userId)
    .eq("status", "confirmed")
    .gte("start_at", startUtc.toISOString())
    .lte("start_at", endUtc.toISOString());

  const busy: BusyInterval[] = (existing ?? []).map((b: any) => ({
    start: new Date(b.start_at),
    end: new Date(b.end_at),
  }));

  const googleBusy = await getGoogleCalendarBusyIntervals({
    supabaseAdmin: params.supabaseAdmin,
    userId: params.userId,
    timeMinIso: startUtc.toISOString(),
    timeMaxIso: endUtc.toISOString(),
  });

  if (googleBusy.length > 0) busy.push(...googleBusy);
  return busy;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

function formatYmdInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

async function createReminderJobs(params: { bookingId: string; startAt: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const start = new Date(params.startAt).getTime();
  const reminders = [
    { label: "1h", minutes: 60 },
    { label: "15m", minutes: 15 },
    { label: "1m", minutes: 1 },
  ];

  const inserts = reminders
    .map((r) => ({
      booking_id: params.bookingId,
      send_at: new Date(start - r.minutes * 60_000).toISOString(),
      template: r.label,
      status: "pending",
    }))
    .filter((r) => new Date(r.send_at).getTime() > Date.now());

  if (inserts.length === 0) return;
  await supabaseAdmin.from("reminder_jobs").insert(inserts);
}

async function cancelReminderJobs(params: { bookingId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("reminder_jobs")
    .update({ status: "cancelled" })
    .eq("booking_id", params.bookingId)
    .eq("status", "pending");
}
