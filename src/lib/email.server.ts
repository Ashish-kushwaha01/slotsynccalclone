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

type ClarificationEmailParams = {
  toEmail: string;
  toName: string;
  hostName: string;
  eventTitle: string;
  rescheduleUrl: string;
  reason?: string;
};

type CancellationEmailParams = {
  toEmail: string;
  toName: string;
  hostName: string;
  eventTitle: string;
  whenLabel: string;
};

type LandingEmailParams = {
  toEmail: string;
  toName: string;
  hostName: string;
  eventTitle: string;
  landingUrl: string;
};

type LowConfidenceEmailParams = {
  toEmail: string;
  toName: string;
  hostName: string;
  eventTitle: string;
  proposedLabel: string;
};

type AlternativeSlotEmailParams = {
  toEmail: string;
  toName: string;
  hostName: string;
  eventTitle: string;
  requestedLabel: string;
  alternativeLabel: string;
};

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

async function sendEmail(params: {
  toEmail: string;
  subject: string;
  text: string;
  html: string;
}): Promise<EmailResult> {
  const transport = await getTransport();
  if (!transport.ok) return transport;

  try {
    await transport.transporter.sendMail({
      from: transport.from,
      to: params.toEmail,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
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
    "Open Valence to manage this meeting.",
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
    <p>Open Valence to manage this meeting.</p>
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

export async function sendBookingClarificationEmail(
  params: ClarificationEmailParams,
): Promise<EmailResult> {
  const subject = `Quick question about ${params.eventTitle}`;
  const reasonLine = params.reason ? `

${params.reason}
` : "";
  const text = [
    `Hi ${params.toName},`,
    "",
    `I want to help you book time with ${params.hostName}.`,
    reasonLine.trim(),
    "",
    `Please pick a time here: ${params.rescheduleUrl}`,
    "",
    "Thanks!",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <p>Hi ${params.toName},</p>
    <p>I want to help you book time with ${params.hostName}.</p>
    ${params.reason ? `<p>${params.reason}</p>` : ""}
    <p><a href="${params.rescheduleUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Pick a time</a></p>
    <p>Thanks!</p>
  </body>
</html>`;

  return sendEmail({ toEmail: params.toEmail, subject, text, html });
}

export async function sendCancellationConfirmationEmail(
  params: CancellationEmailParams,
): Promise<EmailResult> {
  const subject = `Cancelled: ${params.eventTitle}`;
  const text = [
    `Hi ${params.toName},`,
    "",
    `Your meeting with ${params.hostName} has been cancelled.`,
    `When: ${params.whenLabel}`,
    "",
    "If you need another time, reply and we will help you reschedule.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <p>Hi ${params.toName},</p>
    <p>Your meeting with ${params.hostName} has been cancelled.</p>
    <p><strong>When:</strong> ${params.whenLabel}</p>
    <p>If you need another time, reply and we will help you reschedule.</p>
  </body>
</html>`;

  return sendEmail({ toEmail: params.toEmail, subject, text, html });
}

export async function sendLandingPageEmail(
  params: LandingEmailParams,
): Promise<EmailResult> {
  const subject = `About ${params.eventTitle}`;
  const text = [
    `Hi ${params.toName},`,
    "",
    `${params.hostName} asked me to share a quick overview before you pick a time.`,
    `Read it here: ${params.landingUrl}`,
    "",
    "Thanks!",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <p>Hi ${params.toName},</p>
    <p>${params.hostName} asked me to share a quick overview before you pick a time.</p>
    <p><a href="${params.landingUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">View details</a></p>
    <p>Thanks!</p>
  </body>
</html>`;

  return sendEmail({ toEmail: params.toEmail, subject, text, html });
}

export async function sendLowConfidenceEmail(
  params: LowConfidenceEmailParams,
): Promise<EmailResult> {
  const subject = `Confirm time for ${params.eventTitle}`;
  const text = [
    `Hi ${params.toName},`,
    "",
    `I think you asked to meet with ${params.hostName} at: ${params.proposedLabel}.`,
    "Could you confirm that time?",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <p>Hi ${params.toName},</p>
    <p>I think you asked to meet with ${params.hostName} at:</p>
    <p><strong>${params.proposedLabel}</strong></p>
    <p>Could you confirm that time?</p>
  </body>
</html>`;

  return sendEmail({ toEmail: params.toEmail, subject, text, html });
}

export async function sendAlternativeSlotEmail(
  params: AlternativeSlotEmailParams,
): Promise<EmailResult> {
  const subject = `Alternative time for ${params.eventTitle}`;
  const text = [
    `Hi ${params.toName},`,
    "",
    `The time you requested (${params.requestedLabel}) is no longer available.`,
    `Would ${params.alternativeLabel} work instead?`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <p>Hi ${params.toName},</p>
    <p>The time you requested is no longer available.</p>
    <p><strong>Requested:</strong> ${params.requestedLabel}<br />
       <strong>Alternative:</strong> ${params.alternativeLabel}</p>
    <p>Would this new time work instead?</p>
  </body>
</html>`;

  return sendEmail({ toEmail: params.toEmail, subject, text, html });
}

