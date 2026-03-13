import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  format, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays,
  isSameDay, isToday, addMonths, subMonths,
  addWeeks, subWeeks, startOfDay, parseISO,
  differenceInMinutes, isSameMonth, getHours, getMinutes,
} from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, MapPin, User, Clock } from "lucide-react";
import NewAppointmentDialog from "@/components/appointments/NewAppointmentDialog";
import AppointmentDetailSheet from "@/components/appointments/AppointmentDetailSheet";

type ViewMode = "month" | "week" | "day";

const HOUR_HEIGHT = 72;
const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

// Palette sémantique pour les événements
const APT_COLORS = [
  { bg: "bg-blue-50 border-blue-400",    text: "text-blue-700",   dot: "bg-blue-400",    hover: "hover:bg-blue-100" },
  { bg: "bg-violet-50 border-violet-400", text: "text-violet-700", dot: "bg-violet-400",  hover: "hover:bg-violet-100" },
  { bg: "bg-emerald-50 border-emerald-400", text: "text-emerald-700", dot: "bg-emerald-400", hover: "hover:bg-emerald-100" },
  { bg: "bg-amber-50 border-amber-400",  text: "text-amber-700",  dot: "bg-amber-400",   hover: "hover:bg-amber-100" },
  { bg: "bg-rose-50 border-rose-400",    text: "text-rose-700",   dot: "bg-rose-400",    hover: "hover:bg-rose-100" },
  { bg: "bg-cyan-50 border-cyan-400",    text: "text-cyan-700",   dot: "bg-cyan-400",    hover: "hover:bg-cyan-100" },
];

function getAptColor(id: string) {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return APT_COLORS[hash % APT_COLORS.length];
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [showDialog, setShowDialog] = useState(false);
  const [prefilledStart, setPrefilledStart] = useState<string | undefined>();
  const [nowMinute, setNowMinute] = useState(new Date());
  const [selectedAptId, setSelectedAptId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [busySlots, setBusySlots] = useState<{ start: string; end: string }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setNowMinute(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { fetchAppointments(); fetchBusySlots(); }, [user, currentDate, viewMode]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = (8 - START_HOUR) * HOUR_HEIGHT - 20;
      scrollRef.current.scrollTop = Math.max(scrollTo, 0);
    }
  }, [viewMode]);

  const getViewRange = () => {
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
    return { start, end };
  };

  const fetchAppointments = async () => {
    const { start, end } = getViewRange();
    const { data } = await supabase
      .from("appointments")
      .select("*, leads(first_name, last_name, company)")
      .gte("start_at", start)
      .lte("start_at", end)
      .order("start_at");
    setAppointments(data ?? []);
  };

  const fetchBusySlots = async () => {
    if (!user) return;
    try {
      const { start, end } = getViewRange();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-busy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ timeMin: start, timeMax: end }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setBusySlots(data.busy ?? []);
      }
    } catch {
      // Silently ignore — Google Calendar may not be connected
    }
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

  const aptsForDay = useCallback(
    (day: Date) => appointments.filter((a) => isSameDay(parseISO(a.start_at), day)),
    [appointments]
  );

  const aptTopHeight = (apt: any) => {
    const start = parseISO(apt.start_at);
    const end = parseISO(apt.end_at);
    const startMins = (getHours(start) - START_HOUR) * 60 + getMinutes(start);
    const durMins = Math.max(differenceInMinutes(end, start), 30);
    return {
      top: Math.max((startMins / 60) * HOUR_HEIGHT, 0),
      height: Math.max((durMins / 60) * HOUR_HEIGHT, 32),
    };
  };

  const layoutApts = (dayApts: any[]) => {
    const sorted = [...dayApts].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
    const cols: any[][] = [];
    sorted.forEach((apt) => {
      const { top, height } = aptTopHeight(apt);
      let placed = false;
      for (const col of cols) {
        const last = col[col.length - 1];
        const { top: lt, height: lh } = aptTopHeight(last);
        if (top >= lt + lh - 2) { col.push(apt); placed = true; break; }
      }
      if (!placed) cols.push([apt]);
    });
    const result: Record<string, { col: number; totalCols: number }> = {};
    cols.forEach((col, ci) => {
      col.forEach((apt) => { result[apt.id] = { col: ci, totalCols: cols.length }; });
    });
    return result;
  };

  const yToDatetime = (y: number, day: Date): string => {
    const totalMins = (y / HOUR_HEIGHT) * 60;
    const hour = Math.floor(totalMins / 60) + START_HOUR;
    const rawMin = totalMins % 60;
    const min = Math.round(rawMin / 15) * 15 === 60 ? 0 : Math.round(rawMin / 15) * 15;
    const carry = Math.round(rawMin / 15) * 15 === 60 ? 1 : 0;
    const d = new Date(day);
    d.setHours(Math.min(hour + carry, END_HOUR - 1), min, 0, 0);
    return toDatetimeLocal(d);
  };

  const handleSlotClick = (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    if ((e.target as HTMLElement).closest("[data-apt]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const clickedDatetime = yToDatetime(y, day);
    const clickedDate = new Date(clickedDatetime);

    // Check if this time slot is busy in Google Calendar
    const isBusy = busySlots.some((slot) => {
      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);
      return clickedDate >= slotStart && clickedDate < slotEnd;
    });

    if (isBusy) {
      toast.info("Ce créneau est déjà occupé dans le calendrier Google.");
      return;
    }

    setPrefilledStart(clickedDatetime);
    setShowDialog(true);
  };

  const openNewRdv = () => { setPrefilledStart(undefined); setShowDialog(true); };
  const openAptDetail = (id: string) => { setSelectedAptId(id); setShowDetail(true); };

  const monthStart = startOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(calStart, i));
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  const nowTop = (() => {
    const mins = (getHours(nowMinute) - START_HOUR) * 60 + getMinutes(nowMinute);
    return (mins / 60) * HOUR_HEIGHT;
  })();
  const nowVisible = getHours(nowMinute) >= START_HOUR && getHours(nowMinute) < END_HOUR;

  const headerLabel =
    viewMode === "month"
      ? format(currentDate, "MMMM yyyy", { locale: fr })
      : viewMode === "week"
      ? `${format(weekStart, "d MMM", { locale: fr })} – ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}`
      : format(currentDate, "EEEE d MMMM yyyy", { locale: fr });

  // ── Time grid (week / day) ──────────────────────────────────────
  const TimeGrid = ({ cols }: { cols: Date[] }) => {
    const isDay = cols.length === 1;
    return (
      <div className="flex flex-col h-full">
        {/* Column headers */}
        <div className="flex shrink-0 border-b border-border bg-card/80">
          <div className="w-16 shrink-0 border-r border-border" />
          {cols.map((day, i) => (
            <div
              key={i}
              onClick={() => { if (!isDay) { setCurrentDate(day); setViewMode("day"); } }}
              className={`flex-1 py-3 text-center border-r border-border last:border-r-0 transition-colors
                ${!isDay ? "cursor-pointer hover:bg-muted/40" : ""}
                ${isToday(day) ? "bg-primary/5" : ""}
              `}
            >
              <p className={`text-[10px] uppercase font-bold tracking-widest ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>
                {format(day, "EEE", { locale: fr })}
              </p>
              <div className={`mx-auto mt-1.5 w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-all
                ${isToday(day)
                  ? "gradient-primary text-primary-foreground shadow-primary"
                  : "text-foreground hover:bg-muted"}`}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Scrollable time body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <div className="flex" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px`, minHeight: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
            {/* Hour labels */}
            <div className="w-16 shrink-0 border-r border-border relative select-none">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-0 flex items-center pr-3"
                  style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT - 9}px` }}
                >
                  <span className="text-[11px] font-medium text-muted-foreground/60">
                    {String(h).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {cols.map((day, colIdx) => {
              const dayApts = aptsForDay(day);
              const layout = layoutApts(dayApts);
              return (
                <div
                  key={colIdx}
                  className={`flex-1 relative border-r border-border last:border-r-0 ${isToday(day) ? "bg-primary/[0.018]" : ""}`}
                  onClick={(e) => handleSlotClick(e, day)}
                  style={{ cursor: "crosshair" }}
                >
                  {/* Hour lines */}
                  {hours.map((h) => (
                    <div key={h} className="absolute inset-x-0 pointer-events-none" style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}>
                      <div className="border-t border-border/50 w-full" />
                      <div className="border-t border-border/20 w-full" style={{ marginTop: `${HOUR_HEIGHT / 2}px` }} />
                    </div>
                  ))}

                  {/* Now indicator */}
                  {isToday(day) && nowVisible && (
                    <div
                      className="absolute inset-x-0 z-30 pointer-events-none flex items-center"
                      style={{ top: `${nowTop}px` }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive border-2 border-card shadow-sm -ml-1.5 shrink-0" />
                      <div className="flex-1 h-[1.5px] bg-destructive/70" />
                    </div>
                  )}

                  {/* Google Calendar busy slots — greyed blocked periods */}
                  {busySlots
                    .filter((slot) => isSameDay(parseISO(slot.start), day))
                    .map((slot, idx) => {
                      const slotStart = parseISO(slot.start);
                      const slotEnd = parseISO(slot.end);
                      const startMins = (getHours(slotStart) - START_HOUR) * 60 + getMinutes(slotStart);
                      const durMins = Math.max(differenceInMinutes(slotEnd, slotStart), 15);
                      const topPx = Math.max((startMins / 60) * HOUR_HEIGHT, 0);
                      const heightPx = Math.max((durMins / 60) * HOUR_HEIGHT, 12);
                      return (
                        <div
                          key={`busy-${idx}`}
                          className="absolute inset-x-0 z-10 pointer-events-none"
                          style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                        >
                          <div
                            className="h-full w-full border-t border-b border-muted-foreground/20"
                            style={{
                              backgroundColor: "hsl(var(--muted) / 0.55)",
                              backgroundImage:
                                "repeating-linear-gradient(45deg, transparent, transparent 5px, hsl(var(--muted-foreground) / 0.06) 5px, hsl(var(--muted-foreground) / 0.06) 10px)",
                            }}
                          />
                        </div>
                      );
                    })}

                  {/* Appointments */}
                  {dayApts.map((apt) => {
                    const { top, height } = aptTopHeight(apt);
                    const info = layout[apt.id] ?? { col: 0, totalCols: 1 };
                    const color = getAptColor(apt.id);
                    const widthPct = 100 / info.totalCols;
                    const leftPct = info.col * widthPct;
                    const isShort = height < 48;
                    return (
                      <div
                        key={apt.id}
                        data-apt="true"
                        className={`absolute rounded-lg overflow-hidden cursor-pointer z-20 border-l-[3px] transition-all hover:shadow-md hover:brightness-95 hover:z-30 ${color.bg} ${color.hover}`}
                        style={{
                          top: `${top + 1}px`,
                          height: `${height - 2}px`,
                          left: `calc(${leftPct}% + 3px)`,
                          width: `calc(${widthPct}% - 6px)`,
                        }}
                        onClick={(e) => { e.stopPropagation(); openAptDetail(apt.id); }}
                      >
                        <div className="px-2 py-1 h-full flex flex-col justify-start overflow-hidden">
                          <p className={`text-[11px] font-bold leading-tight truncate flex items-center gap-1 ${color.text}`}>
                            <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" />
                            {format(parseISO(apt.start_at), "HH:mm")}
                            {!isShort && ` – ${format(parseISO(apt.end_at), "HH:mm")}`}
                          </p>
                          <p className={`text-xs font-semibold leading-tight truncate mt-0.5 ${color.text}`}>
                            {apt.title}
                          </p>
                          {apt.leads && !isShort && (
                            <p className={`text-[11px] leading-tight truncate mt-0.5 opacity-75 ${color.text} flex items-center gap-0.5`}>
                              <User className="w-2.5 h-2.5 shrink-0" />
                              {apt.leads.first_name} {apt.leads.last_name}
                            </p>
                          )}
                          {apt.location && !isShort && height > 70 && (
                            <p className={`text-[11px] leading-tight truncate opacity-65 ${color.text} flex items-center gap-0.5`}>
                              <MapPin className="w-2.5 h-2.5 shrink-0" />
                              {apt.location}
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
  };

  // ── Month view ──────────────────────────────────────────────────
  const MonthView = () => (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 border-b border-border shrink-0 bg-muted/20">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="py-3 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 overflow-auto">
        {days.map((day, idx) => {
          const dayApts = aptsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isWknd = idx % 7 >= 5;
          return (
            <div
              key={idx}
              onClick={() => { setCurrentDate(day); setViewMode("day"); }}
              className={`border-b border-r border-border p-1.5 cursor-pointer transition-colors hover:bg-accent/30 group
                ${!isCurrentMonth ? "bg-muted/10" : isWknd ? "bg-muted/5" : ""}
                ${idx % 7 === 6 ? "border-r-0" : ""}
                ${isToday(day) ? "bg-primary/[0.04]" : ""}
              `}
              style={{ minHeight: "108px" }}
            >
              <div className="flex items-start justify-between mb-1">
                <span className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all
                  ${isToday(day)
                    ? "gradient-primary text-primary-foreground shadow-sm"
                    : isCurrentMonth
                    ? "text-foreground group-hover:bg-muted"
                    : "text-muted-foreground/40"}`}>
                  {format(day, "d")}
                </span>
                {dayApts.length > 0 && (
                  <span className="text-[10px] font-semibold text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    {dayApts.length} RDV
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayApts.slice(0, 3).map((apt) => {
                  const color = getAptColor(apt.id);
                  return (
                    <div
                      key={apt.id}
                      onClick={(e) => { e.stopPropagation(); openAptDetail(apt.id); }}
                      className={`text-[11px] rounded-md px-1.5 py-0.5 truncate border-l-2 leading-tight font-semibold transition-colors cursor-pointer ${color.bg} ${color.text} ${color.hover}`}
                    >
                      <span className="opacity-70">{format(parseISO(apt.start_at), "HH:mm")}</span>{" "}
                      {apt.title}
                    </div>
                  );
                })}
                {dayApts.length > 3 && (
                  <div className="text-[10px] text-primary font-semibold pl-1">
                    +{dayApts.length - 3} autre{dayApts.length - 3 > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Day summary strip ───────────────────────────────────────────
  const TodaySummary = () => {
    if (viewMode !== "day") return null;
    const todayApts = aptsForDay(currentDate);
    if (todayApts.length === 0) return (
      <div className="mx-6 mb-3 px-4 py-2.5 bg-muted/40 rounded-xl border border-border text-sm text-muted-foreground flex items-center gap-2.5">
        <CalendarDays className="w-4 h-4 text-muted-foreground/60 shrink-0" />
        Aucun rendez-vous ce jour — cliquez sur un créneau pour en créer un.
      </div>
    );
    return (
      <div className="mx-6 mb-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground">Aujourd'hui :</span>
        {todayApts.map((apt) => {
          const color = getAptColor(apt.id);
          return (
            <span
              key={apt.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${color.bg} ${color.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
              {format(parseISO(apt.start_at), "HH:mm")} {apt.title}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-background" style={{ height: "100vh" }}>

      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between shrink-0 border-b border-border bg-card shadow-card">
        <div className="flex items-center gap-4">
          {/* Icon + title */}
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-primary shrink-0">
            <CalendarDays className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Calendrier</h1>
            <p className="text-sm text-muted-foreground capitalize font-medium">{headerLabel}</p>
          </div>

          {/* Nav arrows + Today */}
          <div className="flex items-center gap-1 ml-1">
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={goBack}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline" size="sm"
              className="h-8 px-3 text-xs font-semibold rounded-lg border-border hover:bg-accent hover:text-accent-foreground"
              onClick={() => setCurrentDate(new Date())}
            >
              Aujourd'hui
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={goForward}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === v
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }`}
              >
                {v === "month" ? "Mois" : v === "week" ? "Semaine" : "Jour"}
              </button>
            ))}
          </div>

          {/* New appointment */}
          <Button
            size="sm"
            className="gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg shadow-primary hover:shadow-primary/60 transition-all"
            onClick={openNewRdv}
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau RDV
          </Button>
        </div>
      </div>

      {/* ── Today's event strip (day view only) ── */}
      <div className="pt-3">
        <TodaySummary />
      </div>

      {/* ── Calendar body ── */}
      <div className="flex-1 overflow-hidden mx-6 mb-6 border border-border rounded-2xl bg-card shadow-card">
        {viewMode === "month" && <MonthView />}
        {viewMode === "week" && <TimeGrid cols={weekDays} />}
        {viewMode === "day" && <TimeGrid cols={[currentDate]} />}
      </div>

      <NewAppointmentDialog
        open={showDialog}
        onClose={() => { setShowDialog(false); setPrefilledStart(undefined); }}
        onCreated={fetchAppointments}
        defaultStartAt={prefilledStart}
      />

      <AppointmentDetailSheet
        appointmentId={selectedAptId}
        open={showDetail}
        onClose={() => { setShowDetail(false); setSelectedAptId(null); }}
        onDeleted={fetchAppointments}
      />
    </div>
  );
}
