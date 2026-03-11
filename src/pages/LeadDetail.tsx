import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, LEAD_STATUSES } from "@/lib/leadStatus";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, Mail, Globe, Building, User, Loader2,
  PhoneCall, MessageSquare, Calendar, Clock, Send, Edit3, Check, X
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import NewAppointmentDialog from "@/components/appointments/NewAppointmentDialog";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
    if (id) {
      fetchAll();
      fetchProfile();
    }
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
      // Log status change
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
    // If Aircall key available, try click-to-call
    if (profile?.aircall_api_key) {
      try {
        const resp = await fetch("https://api.aircall.io/v1/calls/dial", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${profile.aircall_api_key}`,
          },
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
      case "appel": return <PhoneCall className="w-3.5 h-3.5 text-green-600" />;
      case "rdv": return <Calendar className="w-3.5 h-3.5 text-purple-600" />;
      case "statut": return <Check className="w-3.5 h-3.5 text-blue-600" />;
      default: return <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full py-24">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
  if (!lead) return (
    <div className="p-8 text-center text-muted-foreground">Lead introuvable</div>
  );

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate("/leads")} className="text-muted-foreground hover:text-foreground mt-1 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{lead.first_name} {lead.last_name}</h1>
            <StatusBadge status={lead.status} />
          </div>
          <p className="text-muted-foreground mt-0.5">
            {lead.company ?? ""}{lead.company && lead.position ? " · " : ""}{lead.position ?? ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lead.phone && (
            <Button size="sm" className="gap-2" onClick={handleCall} disabled={calling}>
              {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
              Appeler
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowApptDialog(true)}>
            <Calendar className="w-4 h-4" /> RDV
          </Button>
          <Button size="sm" variant={editing ? "outline" : "ghost"} onClick={() => { setEditing(!editing); setEditForm(lead); }}>
            {editing ? <><X className="w-4 h-4 mr-1" /> Annuler</> : <><Edit3 className="w-4 h-4 mr-1" /> Éditer</>}
          </Button>
        </div>
      </div>

      {/* Call note modal */}
      {showCallNote && (
        <Card className="border-green-200 bg-green-50 shadow-none">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-green-800 mb-2">📞 Appel terminé — Ajouter une note</p>
            <Textarea
              placeholder="Résumé de l'appel..."
              rows={2}
              value={callNote}
              onChange={(e) => setCallNote(e.target.value)}
              className="bg-white mb-3"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveCallLog}>Enregistrer l'appel</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCallNote(false)}>Ignorer</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Prénom</Label>
                      <Input value={editForm.first_name ?? ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Nom</Label>
                      <Input value={editForm.last_name ?? ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input type="email" value={editForm.email ?? ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Téléphone</Label>
                      <Input value={editForm.phone ?? ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Entreprise</Label>
                      <Input value={editForm.company ?? ""} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Poste</Label>
                      <Input value={editForm.position ?? ""} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Site internet</Label>
                    <Input value={editForm.website ?? ""} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Statut</Label>
                      <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Source</Label>
                      <Input value={editForm.source ?? ""} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Textarea rows={3} value={editForm.notes ?? ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Sauvegarder</>}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <InfoRow icon={<User className="w-4 h-4" />} label="Nom" value={`${lead.first_name} ${lead.last_name}`} />
                  <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={lead.email} href={`mailto:${lead.email}`} />
                  <InfoRow icon={<Phone className="w-4 h-4" />} label="Téléphone" value={lead.phone} href={`tel:${lead.phone}`} />
                  <InfoRow icon={<Building className="w-4 h-4" />} label="Entreprise" value={lead.company} />
                  <InfoRow icon={<User className="w-4 h-4" />} label="Poste" value={lead.position} />
                  <InfoRow icon={<Globe className="w-4 h-4" />} label="Site web" value={lead.website} href={lead.website} external />
                  <InfoRow icon={<MessageSquare className="w-4 h-4" />} label="Source" value={lead.source} />
                  {lead.notes && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{lead.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointments */}
          {appointments.length > 0 && (
            <Card className="border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Rendez-vous ({appointments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {appointments.map((apt) => (
                  <div key={apt.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="text-center min-w-[50px]">
                      <p className="text-xs font-bold text-primary">{format(new Date(apt.start_at), "d MMM", { locale: fr })}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(apt.start_at), "HH:mm")}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{apt.title}</p>
                      {apt.location && <p className="text-xs text-muted-foreground">{apt.location}</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Call logs */}
          {calls.length > 0 && (
            <Card className="border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Appels ({calls.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {calls.map((call) => (
                  <div key={call.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <PhoneCall className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{format(new Date(call.called_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                      {call.duration_seconds > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {Math.floor(call.duration_seconds / 60)}min {call.duration_seconds % 60}s
                        </p>
                      )}
                      {call.notes && <p className="text-xs text-muted-foreground mt-0.5">{call.notes}</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Activity timeline */}
        <div>
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Activité</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Add note */}
              <div className="mb-4">
                <Textarea
                  placeholder="Ajouter une note..."
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mb-2"
                />
                <Button size="sm" className="w-full gap-2" onClick={handleAddNote} disabled={!note.trim() || addingNote}>
                  {addingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Ajouter
                </Button>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune activité</p>
                ) : (
                  activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        {activityIcon(act.type)}
                      </div>
                      <div>
                        <p className="text-xs text-foreground">{act.content}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(act.created_at), "d MMM HH:mm", { locale: fr })}
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

function InfoRow({ icon, label, value, href, external }: { icon: React.ReactNode; label: string; value?: string | null; href?: string; external?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} target={external ? "_blank" : undefined} rel="noopener noreferrer"
            className="text-sm text-primary hover:underline">
            {value}
          </a>
        ) : (
          <p className="text-sm text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-foreground">{children}</label>;
}
