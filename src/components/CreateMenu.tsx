import { useEffect, useRef, useState } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const OPTIONS = [
  { key: "one-on-one", label: "One-on-one", host: "1 host", invitee: "1 invitee", desc: "Good for coffee chats, 1:1 interviews, etc.", enabled: true },
  { key: "group", label: "Group", host: "1 host", invitee: "Multiple invitees", desc: "Webinars, online classes, etc.", enabled: false },
  { key: "round-robin", label: "Round robin", host: "Rotating hosts", invitee: "1 invitee", desc: "Distribute meetings between team members", enabled: false },
  { key: "collective", label: "Collective", host: "Multiple hosts", invitee: "1 invitee", desc: "Panel interviews, group sales calls, etc.", enabled: false },
] as const;

const MORE = [
  { key: "one-off", label: "One-off meeting", desc: "Offer time outside your normal schedule" },
  { key: "poll", label: "Meeting poll", desc: "Let invitees vote on a time to meet" },
] as const;

export function CreateMenu({ onCreateOneOnOne }: { onCreateOneOnOne: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="btn-primary">
        <span className="text-base leading-none">+</span> Create
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-lift">
          <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Event type
          </div>
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                setOpen(false);
                if (o.enabled) onCreateOneOnOne();
                else toast.info(`${o.label} is coming soon`);
              }}
              className="block w-full px-4 py-2.5 text-left hover:bg-brand-soft/60"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-brand">
                {o.label}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                {o.host} <ArrowRight className="h-3 w-3" /> {o.invitee}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{o.desc}</div>
            </button>
          ))}
          <div className="border-t border-border px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            More ways to meet
          </div>
          {MORE.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                setOpen(false);
                toast.info(`${o.label} is coming soon`);
              }}
              className="block w-full px-4 py-2.5 text-left hover:bg-brand-soft/60"
            >
              <div className="text-sm font-semibold text-brand">{o.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{o.desc}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
