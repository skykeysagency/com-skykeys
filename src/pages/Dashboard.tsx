import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, LEAD_STATUSES } from "@/lib/leadStatus";
import { Users, Calendar, Phone, TrendingUp, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format, isToday, isTomorrow, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeLeads: 0,
    todayAppointments: 0,
    totalCalls: 0,
  });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();

    const [leadsRes, apptRes, callsRes, recentRes, todayApptRes] = await Promise.all([
      supabase.from("leads").select("status"),
      supabase.from("appointments").select("id", { count: "exact" }).gte("start_at", todayStart).lte("start_at", todayEnd),
      supabase.from("call_logs").select("id", { count: "exact" }),
      supabase.from("leads").select("id, first_name, last_name, company, status, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("appointments").select("id, title, start_at, lead_id, leads(first_name, last_name)").gte("start_at", todayStart).lte("start_at", todayEnd).order("start_at"),
    ]);

    const leads = leadsRes.data ?? [];
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      counts[l.status] = (counts[l.status] ?? 0) + 1;
    });
    setStatusCounts(counts);
    setStats({
      totalLeads: leads.length,
      activeLeads: leads.filter((l) => !["gagne", "perdu"].includes(l.status)).length,
      todayAppointments: apptRes.count ?? 0,
      totalCalls: callsRes.count ?? 0,
    });
    setRecentLeads(recentRes.data ?? []);
    setTodayAppointments(todayApptRes.data ?? []);
    setLoading(false);
  };

  const kpis = [
    { label: "Leads actifs", value: stats.activeLeads, total: stats.totalLeads, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "RDV aujourd'hui", value: stats.todayAppointments, icon: Calendar, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Appels passés", value: stats.totalCalls, icon: Phone, color: "text-green-600", bg: "bg-green-50" },
    { label: "Leads gagnés", value: statusCounts["gagne"] ?? 0, icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, total, icon: Icon, color, bg }) => (
          <Card key={label} className="border-border shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{label}</p>
                  <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
                  {total !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">sur {total} total</p>
                  )}
                </div>
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pipeline par statut */}
        <Card className="lg:col-span-1 border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {LEAD_STATUSES.map(({ value, label }) => {
              const count = statusCounts[value] ?? 0;
              const pct = stats.totalLeads > 0 ? Math.round((count / stats.totalLeads) * 100) : 0;
              return (
                <div key={value}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={value} />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full">
                    <div
                      className="h-1.5 bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* RDV du jour */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">RDV du jour</CardTitle>
              <Link to="/calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
                Voir tout <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun RDV aujourd'hui</p>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((apt) => (
                  <div key={apt.id} className="flex items-start gap-3">
                    <div className="text-center min-w-[40px]">
                      <p className="text-xs font-bold text-primary">{format(new Date(apt.start_at), "HH:mm")}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{apt.title}</p>
                      {apt.leads && (
                        <p className="text-xs text-muted-foreground">
                          {apt.leads.first_name} {apt.leads.last_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads récents */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Leads récents</CardTitle>
              <Link to="/leads" className="text-xs text-primary hover:underline flex items-center gap-1">
                Voir tout <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun lead</p>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <Link key={lead.id} to={`/leads/${lead.id}`} className="flex items-center gap-3 hover:bg-accent rounded-lg p-1.5 -mx-1.5 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-primary">
                        {lead.first_name.charAt(0)}{lead.last_name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{lead.first_name} {lead.last_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.company ?? "—"}</p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
