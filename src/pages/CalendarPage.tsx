import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  format,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  addDays, isSameDay, isToday,
  addMonths, subMonths,
  addWeeks, subWeeks,
  addDays as addD,
  startOfDay,
  parseISO,
  differenceInMinutes,
  setHours, setMinutes,
  isSameMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import NewAppointmentDialog from "@/components/appointments/NewAppointmentDialog";

type ViewMode = "month" | "week" | "day";

const HOUR_HEIGHT = 64; // px per hour
const START_HOUR = 7;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR;

export default function CalendarPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAppointments();
  }, [user, currentDate, viewMode]);

  // Auto-scroll to 8h on load
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - START_HOUR) * HOUR_HEIGHT;
    }
  }, [viewMode]);

  const fetchAppointments = async () => {
    setLoading(true);
    let start: string, end: string;
    if (viewMode === "month") {
      start = startOfMonth(currentDate).toISOString();
      end = endOfMonth(currentDate).toISOString();
    } else if (viewMode === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: 1 }).toISOString();
      end = endOfWeek(currentDate, { weekStartsOn: 1 }).toISOString();
    } else {
      start = startOfDay(currentDate).toISOString();
      end = new Date(startOfDay(currentDate).getTime() + 86400000).toISOString();
    }
    const { data } = await supabase
      .from("appointments")
      .select("*, leads(first_name, last_name)")
      .gte("start_at", start)
      .lte("start_at", end)
      .order("start_at");
    setAppointments(data ?? []);
    setLoading(false);
  };

  const goBack = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };
  const goForward = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const aptsForDay = (day: Date) =>
    appointments.filter((a) => isSameDay(parseISO(a.start_at), day));

  // Position & height of an appointment in the time grid
  const aptStyle = (apt: any) => {
    const start = parseISO(apt.start_at);
    const end = parseISO(apt.end_at);
    const startMins = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const durationMins = Math.max(differenceInMinutes(end, start), 30);
    const top = (startMins / 60) * HOUR_HEIGHT;
    const height = (durationMins / 60) * HOUR_HEIGHT;
    return { top: `${Math.max(top, 0)}px`, height: `${Math.max(height, 28)}px` };
  };

  // Month grid
  const monthStart = startOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(calStart, i));

  // Week grid
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Hours array
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  const headerLabel =
    viewMode === "month"
      ? format(currentDate, "MMMM yyyy", { locale: fr })
      : viewMode === "week"
      ? `${format(weekStart, "d MMM", { locale: fr })} – ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}`
      : format(currentDate, "EEEE d MMMM yyyy", { locale: fr });

  // Time grid shared component for day/week
  const TimeGrid = ({ days }: { days: Date[] }) => (
    <div className="flex flex-col overflow-hidden">
      {/* Column headers */}
      <div className="flex border-b border-border bg-card sticky top-0 z-10">
        <div className="w-14 shrink-0" />
        {days.map((day, i) => (
          <div
            key={i}
            className={`flex-1 py-2 text-center border-l border-border ${isToday(day) ? "bg-primary/5" : ""}`}
          >
            <p className="text-xs text-muted-foreground uppercase font-medium">
              {format(day, "EEE", { locale: fr })}
            </p>
            <div
              className={`mx-auto mt-0.5 w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold ${
                isToday(day)
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground"
              }`}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
        <div className="flex relative" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 relative">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute w-full flex items-start justify-end pr-2"
                style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT - 8}px`, height: `${HOUR_HEIGHT}px` }}
              >
                <span className="text-xs text-muted-foreground font-medium">
                  {h}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, colIdx) => {
            const dayApts = aptsForDay(day);
            return (
              <div
                key={colIdx}
                className={`flex-1 relative border-l border-border ${isToday(day) ? "bg-primary/[0.02]" : ""}`}
              >
                {/* Hour lines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-border/50"
                    style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}
                  >
                    {/* Half-hour line */}
                    <div
                      className="absolute w-full border-t border-border/25"
                      style={{ top: `${HOUR_HEIGHT / 2}px` }}
                    />
                  </div>
                ))}

                {/* Current time indicator */}
                {isToday(day) && (() => {
                  const now = new Date();
                  const mins = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
                  if (mins < 0 || mins > TOTAL_HOURS * 60) return null;
                  return (
                    <div
                      className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                      style={{ top: `${(mins / 60) * HOUR_HEIGHT}px` }}
                    >
                      <div className="w-2 h-2 rounded-full bg-destructive shrink-0 -ml-1" />
                      <div className="h-px flex-1 bg-destructive" />
                    </div>
                  );
                })()}

                {/* Appointments */}
                {dayApts.map((apt) => {
                  const style = aptStyle(apt);
                  return (
                    <div
                      key={apt.id}
                      className="absolute left-0.5 right-0.5 rounded overflow-hidden cursor-pointer hover:brightness-95 transition-all z-20"
                      style={style}
                    >
                      <div className="h-full bg-primary/15 border-l-2 border-primary px-1.5 py-0.5">
                        <p className="text-xs font-semibold text-primary leading-tight truncate">
                          {format(parseISO(apt.start_at), "HH:mm")}
                        </p>
                        <p className="text-xs text-foreground leading-tight truncate">
                          {apt.title}
                        </p>
                        {apt.leads && (
                          <p className="text-xs text-muted-foreground leading-tight truncate">
                            {apt.leads.first_name} {apt.leads.last_name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendrier</h1>
          <p className="text-muted-foreground mt-0.5 capitalize">{headerLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {v === "month" ? "Mois" : v === "week" ? "Semaine" : "Jour"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={goBack}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" onClick={goForward}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowDialog(true)}>
            <Plus className="w-4 h-4" /> Nouveau RDV
          </Button>
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-hidden mx-6 mb-6 border border-border rounded-xl bg-card shadow-sm">
        {viewMode === "month" && (
          <div className="flex flex-col h-full">
            {/* Day names */}
            <div className="grid grid-cols-7 border-b border-border">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1">
              {days.map((day, idx) => {
                const dayApts = aptsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                return (
                  <div
                    key={idx}
                    onClick={() => { setCurrentDate(day); setViewMode("day"); }}
                    className={`min-h-[100px] border-b border-r border-border p-1.5 cursor-pointer hover:bg-muted/30 transition-colors
                      ${!isCurrentMonth ? "bg-muted/20" : ""}
                      ${idx % 7 === 6 ? "border-r-0" : ""}
                    `}
                  >
                    <p
                      className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday(day) ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"}
                      `}
                    >
                      {format(day, "d")}
                    </p>
                    {dayApts.slice(0, 3).map((apt) => (
                      <div
                        key={apt.id}
                        className="bg-primary/10 text-primary text-xs rounded px-1 py-0.5 mb-0.5 truncate flex items-center gap-1"
                      >
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        {format(parseISO(apt.start_at), "HH:mm")} {apt.title}
                      </div>
                    ))}
                    {dayApts.length > 3 && (
                      <p className="text-xs text-muted-foreground">+{dayApts.length - 3}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "week" && <TimeGrid days={weekDays} />}
        {viewMode === "day" && <TimeGrid days={[currentDate]} />}
      </div>

      <NewAppointmentDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onCreated={fetchAppointments}
      />
    </div>
  );
}
