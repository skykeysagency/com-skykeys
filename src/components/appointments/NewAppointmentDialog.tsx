import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultLeadId?: string;
  defaultLeadName?: string;
}

export default function NewAppointmentDialog({ open, onClose, onCreated, defaultLeadId, defaultLeadName }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: "",
    lead_id: defaultLeadId ?? "",
    start_at: "",
    end_at: "",
    location: "",
    notes: "",
  });

  useEffect(() => {
    setForm((f) => ({ ...f, lead_id: defaultLeadId ?? "" }));
  }, [defaultLeadId]);

  useEffect(() => {
    if (open) fetchLeads();
  }, [open]);

  const fetchLeads = async () => {
    const { data } = await supabase.from("leads").select("id, first_name, last_name, company").order("last_name");
    setLeads(data ?? []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const payload: any = {
      user_id: user.id,
      title: form.title,
      start_at: form.start_at,
      end_at: form.end_at || form.start_at,
      location: form.location || null,
      notes: form.notes || null,
      lead_id: form.lead_id || null,
    };
    const { error } = await supabase.from("appointments").insert([payload]);
    if (error) {
      toast.error("Erreur lors de la création du RDV");
    } else {
      // Log activity
      if (form.lead_id) {
        await supabase.from("activity_logs").insert({
          user_id: user.id, lead_id: form.lead_id, type: "rdv",
          content: `RDV planifié : ${form.title}`
        });
      }
      toast.success("Rendez-vous créé !");
      onCreated();
      onClose();
      setForm({ title: "", lead_id: defaultLeadId ?? "", start_at: "", end_at: "", location: "", notes: "" });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau rendez-vous</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>Titre *</Label>
            <Input placeholder="Démonstration produit" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Lead associé</Label>
            {defaultLeadId && defaultLeadName ? (
              <div className="px-3 py-2 bg-muted rounded-md text-sm text-foreground">{defaultLeadName}</div>
            ) : (
              <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un lead (optionnel)" /></SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.first_name} {l.last_name}{l.company ? ` — ${l.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Début *</Label>
              <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Fin</Label>
              <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Lieu / Lien visio</Label>
            <Input placeholder="Bureau, Zoom, Teams..." value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea placeholder="Notes sur le RDV..." rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
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
