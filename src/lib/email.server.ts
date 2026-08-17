import nodemailer from "nodemailer";

type BookingEmailParams = {
  toEmail: string;
  toName: string;
  hostName: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeNotes?: string | null;
  eventTitle: string;
  startAtIso: string;
  endAtIso: string;
  timeZone: string;
  locationLabel: string;
  meetingUrl?: string;
};

type EmailResult = { ok: boolean; error?: string };

function formatRange(params: { startAtIso: string; endAtIso: string; timeZone: string }): {
  date: string;
  timeRange: string;
} {
  const safeZone = params.timeZone || "UTC";
  let zone = safeZone;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: safeZone }).format(new Date());
  } catch {
    zone = "UTC";
  }

  const start = new Date(params.startAtIso);
  const end = new Date(params.endAtIso);

  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: zone,
  }).format(start);

  const startTime = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: zone,
  }).format(start);

  const endTime = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: zone,
  }).format(end);

  return { date, timeRange: `${startTime} - ${endTime} (${zone})` };
}

function getTransportConfig(): {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
} {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  return { host, port, secure, user, pass, from };
}

function getLocationLine(params: { locationLabel: string; meetingUrl?: string }): string {
  return params.meetingUrl ? `${params.locationLabel}` : params.locationLabel;
}

async function getTransport() {
  const config = getTransportConfig();
  if (!config.host || !config.port || !config.from || !config.user || !config.pass) {
    return { ok: false as const, error: "SMTP config missing" };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure ?? config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });

  return { ok: true as const, transporter, from: config.from };
}

export async function sendBookingConfirmationEmail(
  params: BookingEmailParams,
): Promise<EmailResult> {
  const transport = await getTransport();
  if (!transport.ok) return transport;

  const when = formatRange({
    startAtIso: params.startAtIso,
    endAtIso: params.endAtIso,
    timeZone: params.timeZone,
  });

  const subject = `Booking confirmed: ${params.eventTitle}`;
  const locationLine = getLocationLine(params);
  const joinLine = params.meetingUrl ? `Join: ${params.meetingUrl}` : null;

  const text = [
    `Hi ${params.toName},`,
    "",
    "Your meeting is confirmed.",
    `Event: ${params.eventTitle}`,
    `Host: ${params.hostName}`,
    `When: ${when.date}`,
    `Time: ${when.timeRange}`,
    `Location: ${locationLine}`,
    joinLine,
    "",
    "See you soon.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <p>Hi ${params.toName},</p>
    <p>Your meeting is confirmed.</p>
     <p><strong>Event:</strong> ${params.eventTitle}<br />
       <strong>Host:</strong> ${params.hostName}<br />
       <strong>When:</strong> ${when.date}<br />
       <strong>Time:</strong> ${when.timeRange}<br />
       <strong>Location:</strong> ${locationLine}</p>
     ${
      params.meetingUrl
        ? `<p><a href="${params.meetingUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Join meeting</a></p>`
        : ""
     }
    <p>See you soon.</p>
  </body>
</html>`;

  try {
    await transport.transporter.sendMail({
      from: transport.from,
      to: params.toEmail,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

export async function sendHostBookingNotificationEmail(
  params: BookingEmailParams,
): Promise<EmailResult> {
  const transport = await getTransport();
  if (!transport.ok) return transport;

  const when = formatRange({
    startAtIso: params.startAtIso,
    endAtIso: params.endAtIso,
    timeZone: params.timeZone,
  });

  const subject = `New booking: ${params.eventTitle}`;
  const locationLine = getLocationLine(params);
  const joinLine = params.meetingUrl ? `Join: ${params.meetingUrl}` : null;
  const notes = params.inviteeNotes ? params.inviteeNotes : "No notes";

  const text = [
    `Hi ${params.toName},`,
    "",
    "You have a new booking.",
    `Event: ${params.eventTitle}`,
    `Invitee: ${params.inviteeName} <${params.inviteeEmail}>`,
    `When: ${when.date}`,
    `Time: ${when.timeRange}`,
    `Location: ${locationLine}`,
    joinLine,
    `Notes: ${notes}`,
    "",
    "Open SlotSync to manage this meeting.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <p>Hi ${params.toName},</p>
    <p>You have a new booking.</p>
     <p><strong>Event:</strong> ${params.eventTitle}<br />
       <strong>Invitee:</strong> ${params.inviteeName} (${params.inviteeEmail})<br />
       <strong>When:</strong> ${when.date}<br />
       <strong>Time:</strong> ${when.timeRange}<br />
       <strong>Location:</strong> ${locationLine}<br />
       <strong>Notes:</strong> ${notes}</p>
     ${
      params.meetingUrl
        ? `<p><a href="${params.meetingUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Join meeting</a></p>`
        : ""
     }
    <p>Open SlotSync to manage this meeting.</p>
  </body>
</html>`;

  try {
    await transport.transporter.sendMail({
      from: transport.from,
      to: params.toEmail,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
