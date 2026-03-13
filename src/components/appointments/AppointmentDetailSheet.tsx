import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays, Clock, MapPin, User, Building2, Phone, Mail,
  Briefcase, FileText, Globe, ExternalLink, Pencil, Trash2, Loader2, Video,
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  appointmentId: string | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

function InfoRow({
  icon: Icon, label, value, href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1 truncate"
          >
            {value}
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : (
          <p className="text-sm font-semibold text-foreground truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function AppointmentDetailSheet({ appointmentId, open, onClose, onDeleted }: Props) {
  const [apt, setApt] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && appointmentId) fetchAppointment();
    else setApt(null);
  }, [open, appointmentId]);

  const fetchAppointment = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("*, leads(id, first_name, last_name, company, position, email, phone, website, status)")
      .eq("id", appointmentId!)
      .single();
    setApt(data);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!apt) return;
    setDeleting(true);
    const { error } = await supabase.from("appointments").delete().eq("id", apt.id);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Rendez-vous supprimé");
      onDeleted();
      onClose();
    }
    setDeleting(false);
  };

  const duration = apt
    ? differenceInMinutes(parseISO(apt.end_at), parseISO(apt.start_at))
    : 0;
  const durationLabel =
    duration >= 60
      ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? String(duration % 60).padStart(2, "0") : ""}`
      : `${duration} min`;

  const statusLabels: Record<string, { label: string; class: string }> = {
    nouveau:      { label: "Nouveau",       class: "bg-blue-50 text-blue-700 border-blue-200" },
    contacte:     { label: "Contacté",      class: "bg-violet-50 text-violet-700 border-violet-200" },
    rdv_planifie: { label: "RDV planifié",  class: "bg-amber-50 text-amber-700 border-amber-200" },
    proposition:  { label: "Proposition",  class: "bg-orange-50 text-orange-700 border-orange-200" },
    gagne:        { label: "Gagné",         class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    perdu:        { label: "Perdu",         class: "bg-rose-50 text-rose-700 border-rose-200" },
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : apt ? (
          <div className="flex flex-col h-full">
            {/* Header gradient */}
            <div className="px-6 pt-8 pb-6 gradient-primary relative">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary))_0%,_transparent_60%)]" />
              <SheetHeader className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-xl font-bold text-primary-foreground leading-tight">
                      {apt.title}
                    </SheetTitle>
                    <p className="text-sm text-primary-foreground/75 mt-1 capitalize font-medium">
                      {format(parseISO(apt.start_at), "EEEE d MMMM yyyy", { locale: fr })}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary-foreground/15 flex items-center justify-center shrink-0 backdrop-blur-sm border border-primary-foreground/20">
                    <CalendarDays className="w-6 h-6 text-primary-foreground" />
                  </div>
                </div>

                {/* Time chips */}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-xs font-bold backdrop-blur-sm">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(apt.start_at), "HH:mm")} – {format(parseISO(apt.end_at), "HH:mm")}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary-foreground/15 text-primary-foreground/80 text-xs font-semibold">
                    {durationLabel}
                  </span>
                </div>
              </SheetHeader>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-5 space-y-6 overflow-y-auto">

              {/* RDV Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Rendez-vous</h3>
                <div className="space-y-3">
                  {apt.meeting_link && (
                    <a
                      href={apt.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                        <Video className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Lien Google Meet</p>
                        <p className="text-sm font-semibold text-emerald-800 truncate group-hover:underline">Rejoindre la réunion</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-emerald-600 shrink-0" />
                    </a>
                  )}
                  {apt.location && (
                    <InfoRow icon={MapPin} label="Lieu / Lien" value={apt.location}
                      href={apt.location.startsWith("http") ? apt.location : undefined}
                    />
                  )}
                  {apt.notes && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{apt.notes}</p>
                      </div>
                    </div>
                  )}
                  {!apt.location && !apt.notes && (
                    <p className="text-sm text-muted-foreground italic">Aucun détail supplémentaire</p>
                  )}
                </div>
              </div>

              {/* Lead info */}
              {apt.leads ? (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Prospect</h3>
                      {apt.leads.status && statusLabels[apt.leads.status] && (
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-semibold px-2 py-0.5 ${statusLabels[apt.leads.status].class}`}
                        >
                          {statusLabels[apt.leads.status].label}
                        </Badge>
                      )}
                    </div>

                    {/* Avatar + name */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                      <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-base shadow-primary shrink-0">
                        {apt.leads.first_name?.[0]?.toUpperCase()}{apt.leads.last_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm">
                          {apt.leads.first_name} {apt.leads.last_name}
                        </p>
                        {apt.leads.position && (
                          <p className="text-xs text-muted-foreground truncate">{apt.leads.position}</p>
                        )}
                        {apt.leads.company && (
                          <p className="text-xs text-primary font-semibold truncate">{apt.leads.company}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <InfoRow icon={Mail} label="Email" value={apt.leads.email} href={apt.leads.email ? `mailto:${apt.leads.email}` : undefined} />
                      <InfoRow icon={Phone} label="Téléphone" value={apt.leads.phone} href={apt.leads.phone ? `tel:${apt.leads.phone}` : undefined} />
                      <InfoRow icon={Building2} label="Entreprise" value={apt.leads.company} />
                      <InfoRow icon={Briefcase} label="Poste" value={apt.leads.position} />
                      <InfoRow icon={Globe} label="Site web" value={apt.leads.website} href={apt.leads.website ?? undefined} />
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs font-semibold border-border hover:border-primary/40 hover:text-primary transition-all"
                      onClick={() => { navigate(`/leads/${apt.leads.id}`); onClose(); }}
                    >
                      <User className="w-3.5 h-3.5" />
                      Voir la fiche complète du lead
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Separator />
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border border-dashed">
                    <User className="w-4 h-4 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">Aucun prospect associé</p>
                  </div>
                </>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-border bg-card/80 flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/60 transition-all"
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce rendez-vous ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le rendez-vous «&nbsp;{apt?.title}&nbsp;» sera définitivement supprimé.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs font-semibold ml-auto"
                onClick={onClose}
              >
                Fermer
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
