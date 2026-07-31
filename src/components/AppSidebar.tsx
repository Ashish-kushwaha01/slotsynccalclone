import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  Calendar,
  Contact,
  Workflow,
  ArrowUpCircle,
  Settings as SettingsIcon,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Scheduling", icon: CalendarClock },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/contacts", label: "Contacts", icon: Contact },
  { to: "/automations", label: "Automations", icon: Workflow },
] as const;

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [name, setName] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const meta = (data.user?.user_metadata ?? {}) as { display_name?: string; full_name?: string };
      setName(meta.display_name || meta.full_name || data.user?.email?.split("@")[0] || "");
    });
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col border-r border-border bg-sidebar transition-all",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Workspace header */}
      <div className="relative flex items-center gap-2 border-b border-border px-3 py-3">
        {!collapsed ? (
          <>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                {(name.charAt(0) || "S").toUpperCase()}
              </div>
              <span className="flex-1 truncate text-sm font-semibold text-sidebar-foreground">
                {name || "SlotSync"}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={onToggle}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={onToggle}
            className="mx-auto rounded-md p-2 text-muted-foreground hover:bg-secondary"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        {menuOpen && !collapsed && (
          <div className="absolute left-3 top-full z-30 mt-1 w-52 overflow-hidden rounded-md border border-border bg-popover shadow-lift">
            <button
              onClick={() => {
                setMenuOpen(false);
                signOut();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {nav.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          const isStub = item.to === "/contacts" || item.to === "/automations";
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={(e) => {
                if (isStub) {
                  e.preventDefault();
                  toast.info(`${item.label} is coming soon`);
                }
              }}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-sidebar-active text-sidebar-active-foreground"
                  : "text-sidebar-foreground hover:bg-secondary",
                collapsed && "justify-center px-2",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="space-y-2 border-t border-border p-3">
        {!collapsed && (
          <button
            onClick={() => toast.info("Billing is coming soon")}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
          >
            <ArrowUpCircle className="h-4 w-4" /> Upgrade plan
          </button>
        )}
        <Link
          to="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-secondary",
            pathname.startsWith("/settings") && "bg-sidebar-active text-sidebar-active-foreground",
            collapsed && "justify-center px-2",
          )}
          title={collapsed ? "Settings" : undefined}
        >
          <SettingsIcon className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
