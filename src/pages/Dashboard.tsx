import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge, LEAD_STATUSES } from "@/lib/leadStatus";
import { Users, Calendar, Phone, TrendingUp, ChevronRight, ArrowUpRight, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { format, startOfDay, endOfDay, isSameDay, isAfter } from "date-fns";
import { fr } from "date-fns/locale";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalLeads: 0, activeLeads: 0, todayAppointments: 0, totalCalls: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchDashboardData(); }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const now = new Date();
    const [leadsRes, apptRes, callsRes, recentRes, todayApptRes, remindersRes] = await Promise.all([
      supabase.from("leads").select("status"),
      supabase.from("appointments").select("id", { count: "exact" }).gte("start_at", startOfDay(now).toISOString()).lte("start_at", endOfDay(now).toISOString()),
      supabase.from("call_logs").select("id", { count: "exact" }),
      supabase.from("leads").select("id, first_name, last_name, company, status, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("appointments").select("id, title, start_at, lead_id, leads(first_name, last_name)").gte("start_at", startOfDay(now).toISOString()).lte("start_at", endOfDay(now).toISOString()).order("start_at"),
      supabase.from("call_logs").select("id, reminder_at, notes, lead_id, leads(first_name, last_name, company)").not("reminder_at", "is", null).gte("reminder_at", now.toISOString()).order("reminder_at").limit(10),
    ]);
    const leads = leadsRes.data ?? [];
    const counts: Record<string, number> = {};
    leads.forEach((l) => { counts[l.status] = (counts[l.status] ?? 0) + 1; });
    setStatusCounts(counts);
    setStats({
      totalLeads: leads.length,
      activeLeads: leads.filter((l) => !["gagne", "perdu"].includes(l.status)).length,
      todayAppointments: apptRes.count ?? 0,
      totalCalls: callsRes.count ?? 0,
    });
    setRecentLeads(recentRes.data ?? []);
    setTodayAppointments(todayApptRes.data ?? []);
    setReminders(remindersRes.data ?? []);
    setLoading(false);
  };

  const kpis = [
    {
      label: "Leads actifs",
      value: stats.activeLeads,
      sub: `sur ${stats.totalLeads} total`,
      icon: Users,
      gradient: "from-blue-500 to-indigo-600",
      glow: "shadow-blue-500/20",
      trend: "+12%",
    },
    {
      label: "RDV aujourd'hui",
      value: stats.todayAppointments,
      sub: "rendez-vous planifiés",
      icon: Calendar,
      gradient: "from-violet-500 to-purple-600",
      glow: "shadow-violet-500/20",
      trend: null,
    },
    {
      label: "Appels passés",
      value: stats.totalCalls,
      sub: "au total",
      icon: Phone,
      gradient: "from-emerald-500 to-green-600",
      glow: "shadow-emerald-500/20",
      trend: null,
    },
    {
      label: "Leads gagnés",
      value: statusCounts["gagne"] ?? 0,
      sub: `${stats.totalLeads > 0 ? Math.round(((statusCounts["gagne"] ?? 0) / stats.totalLeads) * 100) : 0}% du pipeline`,
      icon: TrendingUp,
      gradient: "from-amber-500 to-orange-500",
      glow: "shadow-amber-500/20",
      trend: null,
    },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-muted rounded-xl w-64" />
          <div className="grid grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-muted rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
          </p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Tableau de bord</h1>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, gradient, glow, trend }) => (
          <div
            key={label}
            className="bg-card border border-border rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} shadow-lg ${glow} flex items-center justify-center`}>
                <Icon className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              {trend && (
                <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                  <ArrowUpRight className="w-3 h-3" /> {trend}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-foreground tabular-nums">{value}</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Bottom grid ── */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Pipeline */}
        <div className="bg-card border border-border rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-foreground">Pipeline</h2>
            <Link to="/leads" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium">
              Voir tout <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {LEAD_STATUSES.map(({ value, label }) => {
              const count = statusCounts[value] ?? 0;
              const pct = stats.totalLeads > 0 ? Math.round((count / stats.totalLeads) * 100) : 0;
              return (
                <div key={value}>
                  <div className="flex items-center justify-between mb-1.5">
                    <StatusBadge status={value} />
                    <span className="text-xs font-bold text-foreground tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full gradient-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RDV du jour */}
        <div className="bg-card border border-border rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-foreground">RDV du jour</h2>
            <Link to="/calendar" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium">
              Calendrier <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {todayAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Journée libre</p>
              <p className="text-xs text-muted-foreground mt-0.5">Aucun RDV aujourd'hui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((apt) => (
                <div key={apt.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/50 border border-border/50">
                  <div className="min-w-[44px] text-center py-0.5">
                    <p className="text-xs font-bold text-primary">{format(new Date(apt.start_at), "HH:mm")}</p>
                  </div>
                  <div className="w-px self-stretch bg-primary/20" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{apt.title}</p>
                    {apt.leads && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {apt.leads.first_name} {apt.leads.last_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leads récents */}
        <div className="bg-card border border-border rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-foreground">Leads récents</h2>
            <Link to="/leads" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium">
              Voir tout <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Aucun lead</p>
              <p className="text-xs text-muted-foreground mt-0.5">Commencez par en créer un</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentLeads.map((lead) => (
                <Link
                  key={lead.id}
                  to={`/leads/${lead.id}`}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent transition-colors group"
                >
                  <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-primary">
                    {lead.first_name.charAt(0)}{lead.last_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{lead.company ?? "—"}</p>
                  </div>
                  <StatusBadge status={lead.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Rappels ── */}
      {reminders.length > 0 && (
        <div className="bg-card border border-border rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Rappels à venir</h2>
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {reminders.length}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reminders.map((r) => {
              const reminderDate = new Date(r.reminder_at);
              const isToday = isSameDay(reminderDate, new Date());
              return (
                <Link
                  key={r.id}
                  to={r.lead_id ? `/leads/${r.lead_id}` : "#"}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-accent transition-colors group"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isToday ? "bg-amber-100" : "bg-muted"}`}>
                    <Bell className={`w-4 h-4 ${isToday ? "text-amber-600" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {(r.leads as any)?.company ?? `${(r.leads as any)?.first_name} ${(r.leads as any)?.last_name}`}
                    </p>
                    {r.notes && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{r.notes}</p>
                    )}
                    <p className={`text-xs font-medium mt-1 ${isToday ? "text-amber-600" : "text-muted-foreground"}`}>
                      {isToday ? "Aujourd'hui " : ""}{format(reminderDate, isToday ? "HH:mm" : "EEEE d MMM à HH:mm", { locale: fr })}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
