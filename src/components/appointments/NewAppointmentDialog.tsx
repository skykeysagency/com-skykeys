import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, UserSearch, UserPlus, Video, ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultLeadId?: string;
  defaultLeadName?: string;
  defaultStartAt?: string;
}

const EMPTY_PROSPECT = {
  first_name: "", last_name: "", email: "", phone: "", company: "", position: "",
};

export default function NewAppointmentDialog({
  open, onClose, onCreated, defaultLeadId, defaultLeadName, defaultStartAt,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [leadMode, setLeadMode] = useState<"existing" | "new">("existing");
  const [prospect, setProspect] = useState(EMPTY_PROSPECT);
  const [createMeet, setCreateMeet] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    lead_id: defaultLeadId ?? "",
    start_at: defaultStartAt ?? "",
    end_at: "",
    location: "",
    notes: "",
  });
  // Track whether end_at has been auto-filled for the current start_at
  const autoFilledRef = useRef<string>("");

  // Sync props when dialog opens or defaults change
  useEffect(() => {
    if (!open) return;
    fetchLeads();
    setMeetLink(null);
    autoFilledRef.current = "";
    setForm({
      title: "",
      lead_id: defaultLeadId ?? "",
      start_at: defaultStartAt ?? "",
      end_at: "",
      location: "",
      notes: "",
    });
    setProspect(EMPTY_PROSPECT);
    setLeadMode("existing");
    setCreateMeet(false);
  }, [open, defaultLeadId, defaultStartAt]);

  // Auto-fill end_at = start_at + 1h (only once per start_at value)
  useEffect(() => {
    if (form.start_at && !form.end_at && autoFilledRef.current !== form.start_at) {
      autoFilledRef.current = form.start_at;
      const d = new Date(form.start_at);
      d.setHours(d.getHours() + 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      const endStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setForm((f) => ({ ...f, end_at: endStr }));
    }
  }, [form.start_at, form.end_at]);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("leads")
      .select("id, first_name, last_name, company, email")
      .order("last_name");
    setLeads(data ?? []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    let leadId = form.lead_id || null;
    let leadEmail: string | null = null;
    let leadName = "";

    // Create new lead if in "new" mode
    if (leadMode === "new" && prospect.phone) {
      const { data: newLead, error: leadErr } = await supabase
        .from("leads")
        .insert([{
          user_id: user.id,
          first_name: prospect.first_name || "",
          last_name: prospect.last_name || "",
          email: prospect.email || null,
          phone: prospect.phone || null,
          company: prospect.company || null,
          position: prospect.position || null,
          status: "rdv_planifie",
        }])
        .select("id, email, first_name, last_name")
        .single();
      if (leadErr) {
        toast.error("Erreur lors de la création du prospect");
        setLoading(false);
        return;
      }
      leadId = newLead.id;
      leadEmail = newLead.email;
      leadName = `${newLead.first_name} ${newLead.last_name}`.trim();
    } else if (leadId) {
      const lead = leads.find((l) => l.id === leadId);
      leadEmail = lead?.email ?? null;
      leadName = lead ? `${lead.first_name} ${lead.last_name}`.trim() : "";
    }

    const payload: any = {
      user_id: user.id,
      title: form.title,
      start_at: form.start_at,
      end_at: form.end_at || form.start_at,
      location: form.location || null,
      notes: form.notes || null,
      lead_id: leadId,
    };

    const { data: apptData, error } = await supabase
      .from("appointments")
      .insert([payload])
      .select("id")
      .single();

    if (error) {
      toast.error("Erreur lors de la création du RDV");
      setLoading(false);
      return;
    }

    if (leadId) {
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        lead_id: leadId,
        type: "rdv",
        content: `RDV planifié : ${form.title}`,
      });
    }

    // Create Google Meet if requested
    if (createMeet && apptData?.id) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const meetRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-event`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              title: form.title,
              start_at: form.start_at,
              end_at: form.end_at || form.start_at,
              notes: form.notes || "",
              attendee_email: leadEmail,
              attendee_name: leadName,
              appointment_id: apptData.id,
            }),
          }
        );
        const meetData = await meetRes.json();
        if (meetData.meet_link) {
          setMeetLink(meetData.meet_link);
          onCreated();
          toast.success("Lien Google Meet créé ! Invitation envoyée au client.");
        } else {
          toast.warning(meetData.error || "RDV créé mais Google Meet non généré.");
          onCreated();
          onClose();
        }
      } catch {
        toast.warning("RDV créé mais erreur lors de la création Google Meet.");
        onCreated();
        onClose();
      }
    } else {
      toast.success("Rendez-vous créé !");
      onCreated();
      onClose();
    }

    setLoading(false);
  };

  const handleClose = () => {
    onClose();
  };

  const isLocked = !!defaultLeadId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau rendez-vous</DialogTitle>
          <DialogDescription>Planifiez un RDV et associez-le à un lead.</DialogDescription>
        </DialogHeader>

        {meetLink ? (
          // ── Meet link success screen ──
          <div className="space-y-4 mt-2 text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-accent border border-border flex items-center justify-center mx-auto">
              <Video className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">Rendez-vous créé !</p>
              <p className="text-sm text-muted-foreground mt-1">Lien Google Meet généré et invitation envoyée au client.</p>
            </div>
            <a
              href={meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent border border-border text-foreground font-semibold text-sm hover:bg-accent/80 transition-colors"
            >
              <Video className="w-4 h-4 text-primary" />
              Rejoindre Google Meet
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <div>
              <Button onClick={handleClose} className="w-full">Fermer</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            {/* Title */}
            <div className="space-y-1">
              <Label>Titre *</Label>
              <Input
                placeholder="Démonstration produit"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            {/* Date/time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Début *</Label>
                <Input
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) => {
                    setForm({ ...form, start_at: e.target.value, end_at: "" });
                  }}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Fin</Label>
                <Input
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1">
              <Label>Lieu / Lien visio</Label>
              <Input
                placeholder="Bureau, Zoom, Teams..."
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            {/* Lead section */}
            <div className="space-y-2">
              <Label>Associer à un contact</Label>

              {isLocked ? (
                <div className="px-3 py-2 bg-muted rounded-md text-sm text-foreground">
                  {defaultLeadName}
                </div>
              ) : (
                <Tabs value={leadMode} onValueChange={(v) => setLeadMode(v as "existing" | "new")}>
                  <TabsList className="w-full">
                    <TabsTrigger value="existing" className="flex-1 gap-1.5">
                      <UserSearch className="w-3.5 h-3.5" /> Lead existant
                    </TabsTrigger>
                    <TabsTrigger value="new" className="flex-1 gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" /> Nouveau prospect
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing" className="mt-2">
                    <Select
                      value={form.lead_id}
                      onValueChange={(v) => setForm({ ...form, lead_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un lead (optionnel)" />
                      </SelectTrigger>
                      <SelectContent>
                        {leads.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.first_name} {l.last_name}
                            {l.company ? ` — ${l.company}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>

                  <TabsContent value="new" className="mt-2 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Prénom</Label>
                        <Input
                          placeholder="Jean"
                          value={prospect.first_name}
                          onChange={(e) => setProspect({ ...prospect, first_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Nom</Label>
                        <Input
                          placeholder="Dupont"
                          value={prospect.last_name}
                          onChange={(e) => setProspect({ ...prospect, last_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          placeholder="jean@société.fr"
                          value={prospect.email}
                          onChange={(e) => setProspect({ ...prospect, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Téléphone *</Label>
                        <Input
                          placeholder="+33 6 00 00 00 00"
                          value={prospect.phone}
                          onChange={(e) => setProspect({ ...prospect, phone: e.target.value })}
                          required={leadMode === "new"}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Entreprise</Label>
                        <Input
                          placeholder="Acme SAS"
                          value={prospect.company}
                          onChange={(e) => setProspect({ ...prospect, company: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Poste</Label>
                        <Input
                          placeholder="Directeur commercial"
                          value={prospect.position}
                          onChange={(e) => setProspect({ ...prospect, position: e.target.value })}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Un nouveau lead sera créé automatiquement avec le statut "RDV planifié".
                    </p>
                  </TabsContent>
                </Tabs>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                placeholder="Notes sur le RDV..."
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {/* Google Meet option */}
            <div
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                createMeet
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-muted/40 border-border hover:border-emerald-200"
              }`}
              onClick={() => setCreateMeet(!createMeet)}
            >
              <Checkbox
                id="create-meet"
                checked={createMeet}
                onCheckedChange={(v) => setCreateMeet(!!v)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <label
                  htmlFor="create-meet"
                  className="flex items-center gap-2 text-sm font-semibold text-foreground cursor-pointer"
                >
                  <Video className="w-4 h-4 text-primary" />
                  Créer un lien Google Meet
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Génère un lien Meet et envoie l'invitation par email au client automatiquement.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {createMeet ? "Création + Meet…" : "Création…"}</>
                ) : (
                  createMeet ? "Créer le RDV + Meet" : "Créer le RDV"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-foreground">{children}</label>;
}
