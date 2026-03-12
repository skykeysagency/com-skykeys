import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Calendar, Settings, LogOut, Zap, ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/calendar", icon: Calendar, label: "Calendrier" },
  { to: "/settings", icon: Settings, label: "Paramètres" },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const { isManager } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = (() => {
    const meta = (user as any)?.user_metadata;
    if (meta?.first_name && meta?.last_name) {
      return `${meta.first_name[0]}${meta.last_name[0]}`.toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() ?? "?";
  })();

  const displayName = (() => {
    const meta = (user as any)?.user_metadata;
    if (meta?.first_name) return `${meta.first_name} ${meta.last_name ?? ""}`.trim();
    return user?.email ?? "";
  })();

  return (
    <aside className="hidden md:flex flex-col w-[220px] shrink-0 min-h-screen gradient-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center shadow-primary shrink-0">
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <span className="font-bold text-sm text-sidebar-accent-foreground tracking-tight">CommercialCRM</span>
        </div>
      </div>

      {/* ── Separator ── */}
      <div className="mx-4 h-px bg-sidebar-border/60 mb-3" />

      {/* ── Nav label ── */}
      <p className="px-5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-1.5">
        Menu
      </p>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label, end }) => {
          const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-sidebar-primary/15 text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
                isActive
                  ? "gradient-primary shadow-primary"
                  : "bg-sidebar-accent/50 group-hover:bg-sidebar-accent"
              )}>
                <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground")} strokeWidth={2} />
              </div>
              <span>{label}</span>
              {isActive && (
                <div className="ml-auto w-1 h-4 rounded-full bg-sidebar-primary/80" />
              )}
            </NavLink>
          );
        })}

        {/* ── Admin entry (manager/admin only) ── */}
        {isManager && (
          <>
            <div className="mx-0 my-2 h-px bg-sidebar-border/50" />
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-1">
              Administration
            </p>
            {(() => {
              const isActive = location.pathname.startsWith("/admin");
              return (
                <NavLink
                  to="/admin"
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-sidebar-primary/15 text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
                    isActive
                      ? "gradient-primary shadow-primary"
                      : "bg-sidebar-accent/50 group-hover:bg-sidebar-accent"
                  )}>
                    <ShieldCheck className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground")} strokeWidth={2} />
                  </div>
                  <span>Administrateurs</span>
                  {isActive && (
                    <div className="ml-auto w-1 h-4 rounded-full bg-sidebar-primary/80" />
                  )}
                </NavLink>
              );
            })()}
          </>
        )}
      </nav>

      {/* ── User footer ── */}
      <div className="px-3 py-4 border-t border-sidebar-border/60 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center shrink-0 text-[11px] font-bold text-white shadow-primary">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-accent-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-sidebar-foreground/60 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
