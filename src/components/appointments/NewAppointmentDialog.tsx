import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, UserSearch, UserPlus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultLeadId?: string;
  defaultLeadName?: string;
  defaultStartAt?: string; // pre-filled from calendar click
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
  const [leadMode, setLeadMode] = useState<"existing" | "new">(defaultLeadId ? "existing" : "existing");
  const [prospect, setProspect] = useState(EMPTY_PROSPECT);
  const [form, setForm] = useState({
    title: "",
    lead_id: defaultLeadId ?? "",
    start_at: defaultStartAt ?? "",
    end_at: "",
    location: "",
    notes: "",
  });

  useEffect(() => {
    setForm((f) => ({
      ...f,
      lead_id: defaultLeadId ?? "",
      start_at: defaultStartAt ?? f.start_at,
    }));
    if (defaultLeadId) setLeadMode("existing");
  }, [defaultLeadId, defaultStartAt]);

  // Auto-fill end_at = start_at + 1h
  useEffect(() => {
    if (form.start_at && !form.end_at) {
      const d = new Date(form.start_at);
      d.setHours(d.getHours() + 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      const endStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setForm((f) => ({ ...f, end_at: endStr }));
    }
  }, [form.start_at]);

  useEffect(() => {
    if (open) {
      fetchLeads();
      if (!defaultStartAt) {
        // reset end_at when opening fresh
        setForm((f) => ({ ...f, end_at: "" }));
      }
    }
  }, [open]);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("leads")
      .select("id, first_name, last_name, company")
      .order("last_name");
    setLeads(data ?? []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    let leadId = form.lead_id || null;

    // Create new lead if in "new" mode
    if (leadMode === "new" && prospect.first_name && prospect.last_name) {
      const { data: newLead, error: leadErr } = await supabase
        .from("leads")
        .insert([{
          user_id: user.id,
          first_name: prospect.first_name,
          last_name: prospect.last_name,
          email: prospect.email || null,
          phone: prospect.phone || null,
          company: prospect.company || null,
          position: prospect.position || null,
          status: "rdv_planifie",
        }])
        .select("id")
        .single();
      if (leadErr) {
        toast.error("Erreur lors de la création du prospect");
        setLoading(false);
        return;
      }
      leadId = newLead.id;
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

    const { error } = await supabase.from("appointments").insert([payload]);
    if (error) {
      toast.error("Erreur lors de la création du RDV");
    } else {
      if (leadId) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          lead_id: leadId,
          type: "rdv",
          content: `RDV planifié : ${form.title}`,
        });
      }
      toast.success("Rendez-vous créé !");
      onCreated();
      onClose();
      setForm({ title: "", lead_id: defaultLeadId ?? "", start_at: defaultStartAt ?? "", end_at: "", location: "", notes: "" });
      setProspect(EMPTY_PROSPECT);
      setLeadMode("existing");
    }
    setLoading(false);
  };

  const isLocked = !!defaultLeadId;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau rendez-vous</DialogTitle>
        </DialogHeader>

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
                      <Label>Prénom *</Label>
                      <Input
                        placeholder="Jean"
                        value={prospect.first_name}
                        onChange={(e) => setProspect({ ...prospect, first_name: e.target.value })}
                        required={leadMode === "new"}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Nom *</Label>
                      <Input
                        placeholder="Dupont"
                        value={prospect.last_name}
                        onChange={(e) => setProspect({ ...prospect, last_name: e.target.value })}
                        required={leadMode === "new"}
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
                      <Label>Téléphone</Label>
                      <Input
                        placeholder="+33 6 00 00 00 00"
                        value={prospect.phone}
                        onChange={(e) => setProspect({ ...prospect, phone: e.target.value })}
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

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer le RDV"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-foreground">{children}</label>;
}
