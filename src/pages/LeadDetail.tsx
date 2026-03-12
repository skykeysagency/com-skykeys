import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, LEAD_STATUSES } from "@/lib/leadStatus";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import {
  ArrowLeft, Phone, Mail, Globe, Building, User, Loader2,
  PhoneCall, MessageSquare, Calendar, Clock, Send, Edit3, Check, X,
  MapPin, Tag, UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import NewAppointmentDialog from "@/components/appointments/NewAppointmentDialog";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [lead, setLead] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callNote, setCallNote] = useState("");
  const [showCallNote, setShowCallNote] = useState(false);
  const [showApptDialog, setShowApptDialog] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (id) { fetchAll(); fetchProfile(); }
  }, [id]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    setProfile(data);
  };

  const fetchAll = async () => {
    setLoading(true);
    const [leadRes, actRes, callRes, apptRes] = await Promise.all([
      supabase.from("leads").select("*").eq("id", id!).single(),
      supabase.from("activity_logs").select("*").eq("lead_id", id!).order("created_at", { ascending: false }),
      supabase.from("call_logs").select("*").eq("lead_id", id!).order("called_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("lead_id", id!).order("start_at", { ascending: false }),
    ]);
    setLead(leadRes.data);
    setEditForm(leadRes.data ?? {});
    setActivities(actRes.data ?? []);
    setCalls(callRes.data ?? []);
    setAppointments(apptRes.data ?? []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);
    const { first_name, last_name, email, phone, company, position, website, status, source, notes } = editForm;
    const { error } = await supabase.from("leads").update({
      first_name, last_name, email, phone, company, position, website,
      status: status as any, source, notes
    }).eq("id", lead.id);
    if (error) toast.error("Erreur lors de la sauvegarde");
    else {
      toast.success("Lead mis à jour !");
      setEditing(false);
      await fetchAll();
      if (status !== lead.status) {
        await supabase.from("activity_logs").insert({
          user_id: user!.id, lead_id: lead.id, type: "statut",
          content: `Statut changé : ${lead.status} → ${status}`
        });
      }
    }
    setSaving(false);
  };

  const handleAddNote = async () => {
    if (!note.trim() || !user || !lead) return;
    setAddingNote(true);
    await supabase.from("activity_logs").insert({
      user_id: user.id, lead_id: lead.id, type: "note", content: note
    });
    setNote("");
    await fetchAll();
    setAddingNote(false);
    toast.success("Note ajoutée !");
  };

  const handleCall = async () => {
    if (!lead?.phone || !user) return;
    setCalling(true);
    if (profile?.aircall_api_key) {
      try {
        const resp = await fetch("https://api.aircall.io/v1/calls/dial", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${profile.aircall_api_key}` },
          body: JSON.stringify({ phone_number: lead.phone }),
        });
        if (!resp.ok) throw new Error("Aircall error");
        toast.success(`Appel lancé vers ${lead.phone} via Aircall`);
      } catch {
        toast.error("Impossible de lancer l'appel Aircall. Vérifiez votre clé API dans les paramètres.");
        window.open(`tel:${lead.phone}`);
      }
    } else {
      window.open(`tel:${lead.phone}`);
      toast.info("Configurez Aircall dans les paramètres pour le click-to-call automatique");
    }
    setShowCallNote(true);
    setCalling(false);
  };

  const handleSaveCallLog = async () => {
    if (!user || !lead) return;
    await supabase.from("call_logs").insert({
      user_id: user.id, lead_id: lead.id, notes: callNote, status: "completed"
    });
    await supabase.from("activity_logs").insert({
      user_id: user.id, lead_id: lead.id, type: "appel",
      content: callNote ? `Appel — ${callNote}` : "Appel passé"
    });
    setCallNote("");
    setShowCallNote(false);
    await fetchAll();
    toast.success("Appel enregistré !");
  };

  const activityIcon = (type: string) => {
    switch (type) {
      case "appel":   return <PhoneCall className="w-3.5 h-3.5 text-green-600" />;
      case "rdv":     return <Calendar className="w-3.5 h-3.5 text-purple-600" />;
      case "statut":  return <Check className="w-3.5 h-3.5 text-primary" />;
      default:        return <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const activityDot = (type: string) => {
    const map: Record<string, string> = {
      appel: "bg-green-100",
      rdv: "bg-purple-100",
      statut: "bg-accent",
    };
    return map[type] ?? "bg-muted";
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full py-24">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    </div>
  );

  if (!lead) return (
    <div className="p-8 text-center text-muted-foreground">Lead introuvable</div>
  );

  const initials = `${lead.first_name?.charAt(0) ?? ""}${lead.last_name?.charAt(0) ?? ""}`.toUpperCase();

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate("/leads")}
          className="mt-1 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Avatar */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] flex items-center justify-center text-primary-foreground font-bold text-base shrink-0 shadow-primary">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{lead.first_name} {lead.last_name}</h1>
            <StatusBadge status={lead.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lead.company ?? ""}{lead.company && lead.position ? " · " : ""}{lead.position ?? ""}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lead.phone && (
            <Button size="sm" className="gap-1.5 shadow-primary" onClick={handleCall} disabled={calling}>
              {calling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
              Appeler
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowApptDialog(true)}>
            <Calendar className="w-3.5 h-3.5" /> RDV
          </Button>
          <Button
            size="sm"
            variant={editing ? "secondary" : "ghost"}
            onClick={() => { setEditing(!editing); setEditForm(lead); }}
            className="gap-1.5"
          >
            {editing ? <><X className="w-3.5 h-3.5" /> Annuler</> : <><Edit3 className="w-3.5 h-3.5" /> Éditer</>}
          </Button>
        </div>
      </div>

      {/* ── Call note banner ── */}
      {showCallNote && (
        <Card className="border-green-200 bg-green-50/80 shadow-none">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-green-800 mb-2.5 flex items-center gap-2">
              <PhoneCall className="w-4 h-4" /> Appel terminé — ajouter une note
            </p>
            <Textarea
              placeholder="Résumé de l'appel..."
              rows={2}
              value={callNote}
              onChange={(e) => setCallNote(e.target.value)}
              className="bg-card mb-3"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveCallLog} className="shadow-primary">Enregistrer l'appel</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCallNote(false)}>Ignorer</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Grid ── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Left / main */}
        <div className="lg:col-span-2 space-y-5">

          {/* Infos card */}
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Informations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldBlock label="Prénom">
                      <Input value={editForm.first_name ?? ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
                    </FieldBlock>
                    <FieldBlock label="Nom">
                      <Input value={editForm.last_name ?? ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
                    </FieldBlock>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldBlock label="Email">
                      <Input type="email" value={editForm.email ?? ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    </FieldBlock>
                    <FieldBlock label="Téléphone">
                      <Input value={editForm.phone ?? ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                    </FieldBlock>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldBlock label="Entreprise">
                      <Input value={editForm.company ?? ""} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
                    </FieldBlock>
                    <FieldBlock label="Poste">
                      <Input value={editForm.position ?? ""} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} />
                    </FieldBlock>
                  </div>
                  <FieldBlock label="Site internet">
                    <Input value={editForm.website ?? ""} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
                  </FieldBlock>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldBlock label="Statut">
                      <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FieldBlock>
                    <FieldBlock label="Source">
                      <Input value={editForm.source ?? ""} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} />
                    </FieldBlock>
                  </div>
                  <FieldBlock label="Notes">
                    <Textarea rows={3} value={editForm.notes ?? ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                  </FieldBlock>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving} className="shadow-primary gap-1.5">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Sauvegarder
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={lead.email} href={`mailto:${lead.email}`} />
                  <InfoRow icon={<Phone className="w-4 h-4" />} label="Téléphone" value={lead.phone} href={`tel:${lead.phone}`} />
                  <InfoRow icon={<Building className="w-4 h-4" />} label="Entreprise" value={lead.company} />
                  <InfoRow icon={<User className="w-4 h-4" />} label="Poste" value={lead.position} />
                  <InfoRow icon={<Globe className="w-4 h-4" />} label="Site web" value={lead.website} href={lead.website} external />
                  <InfoRow icon={<Tag className="w-4 h-4" />} label="Source" value={lead.source} />
                  {lead.notes && (
                    <div className="col-span-full pt-3 border-t border-border mt-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Notes</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{lead.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointments */}
          {appointments.length > 0 && (
            <Card className="border-border shadow-card">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  Rendez-vous
                  <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{appointments.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {appointments.map((apt) => (
                  <div key={apt.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-border/50">
                    <div className="min-w-[48px] text-center bg-background rounded-lg px-1.5 py-1.5 border border-border">
                      <p className="text-xs font-bold text-primary leading-tight">{format(new Date(apt.start_at), "d MMM", { locale: fr })}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(apt.start_at), "HH:mm")}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{apt.title}</p>
                      {apt.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {apt.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Call logs */}
          {calls.length > 0 && (
            <Card className="border-border shadow-card">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Phone className="w-4 h-4 text-green-600" />
                  Appels
                  <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{calls.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {calls.map((call) => (
                  <div key={call.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-border/50">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                      <PhoneCall className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{format(new Date(call.called_at), "d MMM yyyy · HH:mm", { locale: fr })}</p>
                      {call.duration_seconds > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> {Math.floor(call.duration_seconds / 60)}min {call.duration_seconds % 60}s
                        </p>
                      )}
                      {call.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{call.notes}</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right / activity */}
        <div>
          <Card className="border-border shadow-card sticky top-6">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" /> Activité
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {/* Add note */}
              <div className="mb-4 space-y-2">
                <Textarea
                  placeholder="Ajouter une note..."
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="text-sm resize-none"
                />
                <Button
                  size="sm"
                  className="w-full gap-1.5 shadow-primary"
                  onClick={handleAddNote}
                  disabled={!note.trim() || addingNote}
                >
                  {addingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Ajouter
                </Button>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                {activities.length === 0 ? (
                  <div className="text-center py-6">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Aucune activité</p>
                  </div>
                ) : (
                  activities.map((act, i) => (
                    <div key={act.id} className="flex items-start gap-2.5">
                      <div className="relative flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full ${activityDot(act.type)} flex items-center justify-center flex-shrink-0`}>
                          {activityIcon(act.type)}
                        </div>
                        {i < activities.length - 1 && (
                          <div className="w-px h-full min-h-[12px] bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <p className="text-xs text-foreground leading-relaxed">{act.content}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(act.created_at), "d MMM · HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <NewAppointmentDialog
        open={showApptDialog}
        onClose={() => setShowApptDialog(false)}
        onCreated={fetchAll}
        defaultLeadId={lead.id}
        defaultLeadName={`${lead.first_name} ${lead.last_name}`}
      />
    </div>
  );
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value, href, external }: {
  icon: React.ReactNode; label: string; value?: string | null; href?: string; external?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-accent-foreground shrink-0 mt-0.5">
        <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} target={external ? "_blank" : undefined} rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate block">
            {value}
          </a>
        ) : (
          <p className="text-sm text-foreground truncate">{value}</p>
        )}
      </div>
    </div>
  );
}
