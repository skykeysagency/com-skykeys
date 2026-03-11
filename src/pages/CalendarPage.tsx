import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isToday, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon } from "lucide-react";
import NewAppointmentDialog from "@/components/appointments/NewAppointmentDialog";

export default function CalendarPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAppointments(); }, [user, currentDate, viewMode]);

  const fetchAppointments = async () => {
    setLoading(true);
    const start = viewMode === "month"
      ? startOfMonth(currentDate).toISOString()
      : startOfWeek(currentDate, { weekStartsOn: 1 }).toISOString();
    const end = viewMode === "month"
      ? endOfMonth(currentDate).toISOString()
      : endOfWeek(currentDate, { weekStartsOn: 1 }).toISOString();
    const { data } = await supabase.from("appointments")
      .select("*, leads(first_name, last_name)")
      .gte("start_at", start).lte("start_at", end)
      .order("start_at");
    setAppointments(data ?? []);
    setLoading(false);
  };

  const goBack = () => viewMode === "month" ? setCurrentDate(subMonths(currentDate, 1)) : setCurrentDate(subWeeks(currentDate, 1));
  const goForward = () => viewMode === "month" ? setCurrentDate(addMonths(currentDate, 1)) : setCurrentDate(addWeeks(currentDate, 1));

  const aptsForDay = (day: Date) => appointments.filter((a) => isSameDay(new Date(a.start_at), day));

  // Build calendar grid
  const monthStart = startOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(calStart, i));

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendrier</h1>
          <p className="text-muted-foreground mt-0.5">
            {viewMode === "month"
              ? format(currentDate, "MMMM yyyy", { locale: fr })
              : `Sem. du ${format(weekStart, "d MMM", { locale: fr })}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button onClick={() => setViewMode("month")} className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "month" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}>Mois</button>
            <button onClick={() => setViewMode("week")} className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "week" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}>Semaine</button>
          </div>
          <Button variant="outline" size="icon" onClick={goBack}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Aujourd'hui</Button>
          <Button variant="outline" size="icon" onClick={goForward}><ChevronRight className="w-4 h-4" /></Button>
          <Button size="sm" className="gap-2" onClick={() => setShowDialog(true)}>
            <Plus className="w-4 h-4" /> Nouveau RDV
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-none">
        <CardContent className="p-0">
          {/* Day names header */}
          <div className="grid grid-cols-7 border-b border-border">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>

          {viewMode === "month" && (
            <div className="grid grid-cols-7">
              {days.map((day, idx) => {
                const dayApts = aptsForDay(day);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                return (
                  <div
                    key={idx}
                    className={`min-h-[90px] border-b border-r border-border p-1.5 ${!isCurrentMonth ? "bg-muted/30" : ""} ${idx % 7 === 6 ? "border-r-0" : ""}`}
                  >
                    <p className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday(day) ? "bg-primary text-white" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}>
                      {format(day, "d")}
                    </p>
                    {dayApts.slice(0, 2).map((apt) => (
                      <div key={apt.id} className="bg-primary/10 text-primary text-xs rounded px-1 py-0.5 mb-0.5 truncate">
                        {format(new Date(apt.start_at), "HH:mm")} {apt.title}
                      </div>
                    ))}
                    {dayApts.length > 2 && <p className="text-xs text-muted-foreground">+{dayApts.length - 2}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === "week" && (
            <div className="grid grid-cols-7">
              {weekDays.map((day, idx) => {
                const dayApts = aptsForDay(day);
                return (
                  <div key={idx} className={`min-h-[300px] border-r border-border p-2 ${idx === 6 ? "border-r-0" : ""}`}>
                    <p className={`text-xs font-medium mb-2 w-7 h-7 flex items-center justify-center rounded-full mx-auto ${isToday(day) ? "bg-primary text-white" : "text-foreground"}`}>
                      {format(day, "d")}
                    </p>
                    <div className="space-y-1">
                      {dayApts.map((apt) => (
                        <div key={apt.id} className="bg-primary/10 border-l-2 border-primary rounded p-1.5">
                          <p className="text-xs font-semibold text-primary">{format(new Date(apt.start_at), "HH:mm")}</p>
                          <p className="text-xs text-foreground truncate">{apt.title}</p>
                          {apt.leads && <p className="text-xs text-muted-foreground truncate">{apt.leads.first_name} {apt.leads.last_name}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <NewAppointmentDialog open={showDialog} onClose={() => setShowDialog(false)} onCreated={fetchAppointments} />
    </div>
  );
}
