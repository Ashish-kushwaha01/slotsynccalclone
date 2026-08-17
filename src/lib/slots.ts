// Pure slot computation. No DB, no side effects — safe to test.

export interface AvailabilityRule {
  day_of_week: number; // 0=Sunday .. 6=Saturday
  start_time: string; // "HH:MM:SS"
  end_time: string;
}

export interface DateOverride {
  override_date: string; // "YYYY-MM-DD"
  start_time: string | null;
  end_time: string | null;
  is_unavailable: boolean;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface SlotComputationInput {
  date: string; // YYYY-MM-DD (in host timezone)
  hostTimezone: string;
  durationMin: number;
  slotStepMin?: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  maxAdvanceDays: number;
  rules: AvailabilityRule[];
  overrides: DateOverride[];
  busy: BusyInterval[];
  now?: Date;
}

/** Parse "HH:MM(:SS)?" to minutes-since-midnight. */
function parseTimeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Build a UTC Date for `YYYY-MM-DD` + `minutesFromMidnight` in the given IANA timezone.
 * Uses Intl to determine the timezone offset for that wall-clock instant.
 */
export function zonedDateToUtc(dateYmd: string, minutesFromMidnight: number, timeZone: string): Date {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const hh = Math.floor(minutesFromMidnight / 60);
  const mm = minutesFromMidnight % 60;
  // Guess an instant, then correct for the timezone's offset at that instant.
  const guess = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(guess);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asZonedUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second),
  );
  const offsetMs = guess.getTime() - asZonedUtc;
  return new Date(guess.getTime() + offsetMs);
}

/** Day-of-week (0-6) for a YYYY-MM-DD in a given IANA timezone. */
function dayOfWeekInZone(dateYmd: string, timeZone: string): number {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(y, mo - 1, d, 12));
  const wk = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(utcNoon);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wk] ?? 0;
}

export function computeAvailableSlots(input: SlotComputationInput): Date[] {
  const now = input.now ?? new Date();
  const earliest = new Date(now.getTime() + input.minNoticeMin * 60_000);
  const latest = new Date(now.getTime() + input.maxAdvanceDays * 86_400_000);

  const override = input.overrides.find((o) => o.override_date === input.date);
  const windows: Array<[number, number]> = [];

  if (override) {
    if (override.is_unavailable) return [];
    if (override.start_time && override.end_time) {
      windows.push([parseTimeToMin(override.start_time), parseTimeToMin(override.end_time)]);
    }
  }
  if (windows.length === 0) {
    const dow = dayOfWeekInZone(input.date, input.hostTimezone);
    for (const r of input.rules) {
      if (r.day_of_week === dow) {
        windows.push([parseTimeToMin(r.start_time), parseTimeToMin(r.end_time)]);
      }
    }
  }
  if (windows.length === 0) return [];

  const slotLen = input.durationMin;
  const total = slotLen + input.bufferBeforeMin + input.bufferAfterMin;
  const step = input.slotStepMin ?? slotLen; // slot step in minutes
  const slots: Date[] = [];

  for (const [ws, we] of windows) {
    for (let start = ws; start + slotLen <= we; start += step) {
      const startUtc = zonedDateToUtc(input.date, start, input.hostTimezone);
      const endUtc = new Date(startUtc.getTime() + slotLen * 60_000);
      if (startUtc < earliest || startUtc > latest) continue;

      // Check buffers vs busy
      const bufferedStart = new Date(startUtc.getTime() - input.bufferBeforeMin * 60_000);
      const bufferedEnd = new Date(endUtc.getTime() + input.bufferAfterMin * 60_000);
      const conflict = input.busy.some(
        (b) => b.start < bufferedEnd && b.end > bufferedStart,
      );
      if (!conflict) slots.push(startUtc);
    }
  }
  return slots;
}
