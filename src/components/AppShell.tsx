import { type ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
