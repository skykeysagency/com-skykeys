import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Phone, Calendar, X, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TodayAppointment {
  id: string;
  title: string;
  start_at: string;
  lead_id: string | null;
  leads: {
    first_name: string;
    last_name: string;
    company: string | null;
    phone: string | null;
  } | null;
}

export default function AppointmentReminderModal() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<TodayAppointment[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Check if already dismissed today
    const dismissKey = `appt_reminder_${user.id}_${format(new Date(), "yyyy-MM-dd")}`;
    if (sessionStorage.getItem(dismissKey)) return;

    const now = new Date();
    supabase
      .from("appointments")
      .select("id, title, start_at, lead_id, leads(first_name, last_name, company, phone)")
      .eq("user_id", user.id)
      .gte("start_at", startOfDay(now).toISOString())
      .lte("start_at", endOfDay(now).toISOString())
      .not("lead_id", "is", null)
      .order("start_at")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAppointments(data as unknown as TodayAppointment[]);
          setOpen(true);
        }
      });
  }, [user]);

  const handleDismissAll = () => {
    if (user) {
      const dismissKey = `appt_reminder_${user.id}_${format(new Date(), "yyyy-MM-dd")}`;
      sessionStorage.setItem(dismissKey, "1");
    }
    setOpen(false);
  };

  const handleDismissOne = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const visibleAppointments = appointments.filter((a) => !dismissed.has(a.id));

  useEffect(() => {
    if (open && visibleAppointments.length === 0 && appointments.length > 0) {
      handleDismissAll();
    }
  }, [visibleAppointments.length]);

  const getLeadDisplayName = (leads: TodayAppointment["leads"]) => {
    if (!leads) return "—";
    const hasName = !!(leads.first_name?.trim() || leads.last_name?.trim());
    return hasName
      ? `${leads.first_name ?? ""} ${leads.last_name ?? ""}`.trim()
      : leads.company || "—";
  };

  if (visibleAppointments.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismissAll(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Phone className="w-4 h-4 text-white" />
            </div>
            Rappels du jour
          </DialogTitle>
          <DialogDescription>
            Vous avez {visibleAppointments.length} rendez-vous aujourd'hui. Pensez à appeler vos prospects pour leur rappeler !
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
          {visibleAppointments.map((apt) => {
            const leadName = getLeadDisplayName(apt.leads);
            const phone = apt.leads?.phone;
            const hasValidPhone = phone && !phone.includes("#ERROR");

            return (
              <div
                key={apt.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30 group"
              >
                <div className="min-w-[48px] text-center">
                  <p className="text-xs font-bold text-primary">
                    {format(new Date(apt.start_at), "HH:mm")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(apt.start_at), "dd MMM", { locale: fr })}
                  </p>
                </div>

                <div className="w-px self-stretch bg-border" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {apt.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {leadName}
                    {hasValidPhone && (
                      <span className="ml-1.5 text-muted-foreground/70">· {phone}</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {hasValidPhone && (
                    <a
                      href={`tel:${phone}`}
                      className="w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center transition-colors"
                      title="Appeler"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-700" />
                    </a>
                  )}
                  {apt.lead_id && (
                    <Link
                      to={`/leads/${apt.lead_id}`}
                      onClick={() => handleDismissAll()}
                      className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                      title="Voir le lead"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-primary" />
                    </Link>
                  )}
                  <button
                    onClick={() => handleDismissOne(apt.id)}
                    className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                    title="Fermer"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={handleDismissAll}>
            J'ai compris
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
