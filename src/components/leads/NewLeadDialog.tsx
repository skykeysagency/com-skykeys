import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEAD_STATUSES } from "@/lib/leadStatus";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewLeadDialog({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    company: "", position: "", website: "", status: "nouveau",
    source: "", notes: "",
  });

  const handleChange = (field: string, value: string) => setForm({ ...form, [field]: value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("leads").insert({ ...form, user_id: user.id });
    if (error) {
      toast.error("Erreur lors de la création du lead");
    } else {
      toast.success("Lead créé avec succès !");
      onCreated();
      onClose();
      setForm({ first_name: "", last_name: "", email: "", phone: "", company: "", position: "", website: "", status: "nouveau", source: "", notes: "" });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Prénom *</Label>
              <Input placeholder="Jean" value={form.first_name} onChange={(e) => handleChange("first_name", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Nom *</Label>
              <Input placeholder="Dupont" value={form.last_name} onChange={(e) => handleChange("last_name", e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" placeholder="jean@entreprise.com" value={form.email} onChange={(e) => handleChange("email", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Téléphone</Label>
              <Input placeholder="+33 6 00 00 00 00" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Entreprise</Label>
              <Input placeholder="Acme Corp" value={form.company} onChange={(e) => handleChange("company", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Poste</Label>
              <Input placeholder="Directeur commercial" value={form.position} onChange={(e) => handleChange("position", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Site internet</Label>
            <Input placeholder="https://exemple.com" value={form.website} onChange={(e) => handleChange("website", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Source</Label>
              <Input placeholder="LinkedIn, Salon..." value={form.source} onChange={(e) => handleChange("source", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea placeholder="Notes sur ce lead..." rows={3} value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer le lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
