
# Valence — Calendly-style UI rebuild

Goal: rebuild the authenticated app + public booking flow to visually match your 10 reference screenshots, keeping the Valence name, logo, and the existing backend (profiles, event_types, availability, bookings, webhooks).

I will **not** rebuild every Calendly feature — only what's visible in your screenshots. I'll flag anything I'm faking so we can wire it later.

## What I'll build (mapped to your images)

**Image 1 — Scheduling / Event types list (post-login home)**
- New left sidebar: Scheduling · Calendar · Contacts · Automations, with "Upgrade plan" + "Settings" pinned to bottom, and workspace switcher (avatar + name) up top.
- Main panel: "Scheduling" title, tabs (Event types / Single-use links / Meeting polls / Routing forms — only Event types functional, others show empty state), search bar, host row with "View landing page", event-type cards with "Copy link", external-link icon, and a 3-dot menu (View booking page / Edit / Duplicate / Delete / On-off toggle).
- Right side: "Manage availability" + "Create ▾" buttons.

**Image 2 — Right-side edit drawer**
- Clicking an event card opens a right drawer with collapsible sections: Duration, Location (Google Meet chip + Select location), Availability, Host. Bottom bar: Preview · More options · Save changes.

**Image 5 — Create dropdown**
- "Create ▾" opens a menu: One-on-one, Group, Round robin, Collective, One-off meeting, Meeting poll. Only **One-on-one** is functional (creates a real event_type row); others show a "Coming soon" toast.

**Image 6 — New event type drawer (basic)**
- Same drawer shell with Duration + Location (Zoom/Phone/In-person/All options → Google Meet, Teams, Webex, GoToMeeting, Custom, Ask invitee). We'll store the choice as a string in the existing `location` column.

**Image 7 — New event type drawer (More options)**
- Extra collapsible sections: Description, Limits and buffers (buffer_before/after, min_notice, max_advance — already in schema), Booking page options (slug + increments), Invitee form (name/email/notes — hardcoded for now), plus non-functional "Free/busy rules", "Payment", "Notifications", "Confirmation page" (grey badges "Coming soon").

**Image 3 — Settings → Profile**
- Full-screen settings modal/route with left nav: My account (Profile, Calendar, Branding, My link, Privacy), Features (AI, Contacts settings), Admin (Workspace, Dashboard, People, Access, Security, Billing, Managed events).
- Profile tab: avatar upload, Name, Welcome message (maps to bio), Language, Date format, Time format, Country, Time zone. Only Name/Welcome/Timezone actually save; the rest are UI-only for now.

**Image 4 — Settings → Calendar**
- Tabs: Calendar / Availability / Advanced.
- "Connect calendar account" button (shows "Google Calendar coming soon — needs Client ID/Secret" — matches your env plan).
- If a `google_calendar_connections` row exists, show the connected Google Calendar card exactly like the screenshot.

**Image 8 — Public booking page (invitee, date + time)**
- Redesign `/$username/$slug` to Calendly's two-column layout: left = host name, event title, duration, meeting details; right = month calendar with dotted "has slots" indicator + time zone selector + time-slot list with "Next" confirm button. "Powered by Valence" ribbon.

**Image 9 — Public booking page (enter details)**
- Second step: left column shows chosen date/time summary, right column = Name, Email, "Add guests" (UI only), notes textarea, Schedule Event button.

**Image 10 — Success page**
- "You are scheduled!" checkmark, "Open Invitation" button (links to calendar .ics — stub for now), summary card with title, host, time, timezone, "Web conferencing details to follow."
- Confirmation email: fires the existing `booking.confirmed` webhook to n8n (your n8n flow sends the email). No direct email sending from the app — matches your PRD.

## What's cosmetic-only (labeled in the UI)
Single-use links, Meeting polls, Routing forms, Calendar/Contacts/Automations sidebar entries, Branding, My link, Privacy, AI, Contacts settings, all Admin settings, Payment, Free/busy rules, Notifications, Confirmation page editor, Add guests, Language/Date/Time format/Country. These render but show "Coming soon" or are read-only.

## Technical notes
- No schema changes needed — everything maps to existing columns.
- New components: `AppSidebar`, `SettingsShell` (with left nav + tabs), `EventTypeDrawer`, `CreateMenu`, `PublicBookingLayout` (two-column), `SuccessScreen`.
- Files rewritten: `AppShell.tsx`, `dashboard.tsx` → becomes Scheduling, `event-types.tsx` merged into Scheduling, `settings.tsx` → full settings shell, `availability.tsx` moved under settings, `$username.$slug.tsx`, `booking.$token.tsx` → success/cancel.
- Design: keep your petroleum-blue + coral tokens but tighten spacing/typography to match Calendly's clean look (Inter, generous whitespace, subtle borders, rounded-lg cards).
- One turn = a lot of files. I'll batch writes in parallel.

## Out of scope this turn
- Actual Google Calendar OAuth (waiting on your Client ID/Secret).
- Real avatar upload storage (button will be a placeholder).
- Real email sending (relies on your n8n webhook).
- Reminders cron already exists at `/api/public/hooks/reminders`.

Confirm and I'll start building.

