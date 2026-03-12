import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, User, Phone, Key, Check } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", position: "", aircall_api_key: "" });

  useEffect(() => { fetchProfile(); }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (data) {
      setProfile(data);
      setForm({
        first_name: data.first_name ?? "",
        last_name: data.last_name ?? "",
        position: data.position ?? "",
        aircall_api_key: data.aircall_api_key ?? "",
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("user_id", user.id);
    if (error) toast.error("Erreur lors de la sauvegarde");
    else toast.success("Paramètres sauvegardés !");
    setSaving(false);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 md:p-8 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground mt-0.5">Gérez votre profil et vos intégrations</p>
      </div>

      {/* Profil */}
      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Profil</CardTitle>
          <CardDescription>Vos informations personnelles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Prénom</label>
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="Jean" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Nom</label>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Dupont" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <Input value={user?.email ?? ""} disabled className="bg-muted" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Poste</label>
            <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Commercial, Directeur des ventes..." />
          </div>
        </CardContent>
      </Card>

      {/* Aircall */}
      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="w-4 h-4" /> Intégration Aircall
          </CardTitle>
          <CardDescription>
            Configurez votre clé API Aircall pour activer le click-to-call depuis les fiches leads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> Clé API Aircall
            </label>
            <Input
              type="password"
              value={form.aircall_api_key}
              onChange={(e) => setForm({ ...form, aircall_api_key: e.target.value })}
              placeholder="Votre clé API Aircall..."
            />
          </div>
          <div className="p-3 bg-accent rounded-lg space-y-2">
            <p className="text-xs text-accent-foreground font-medium">Format requis : <code className="bg-background px-1 py-0.5 rounded text-xs font-mono">api_id:api_token</code></p>
            <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
              <li>Connectez-vous à <a href="https://dashboard.aircall.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">dashboard.aircall.io</a></li>
              <li>Allez dans <strong>Intégrations → API Keys</strong></li>
              <li>Copiez l'<strong>API ID</strong> et l'<strong>API Token</strong></li>
              <li>Saisissez : <code className="bg-background px-1 rounded font-mono">votre_api_id:votre_api_token</code></li>
            </ol>
          </div>
          {form.aircall_api_key && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" /> Clé API configurée — le click-to-call est activé
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Sauvegarder les paramètres
      </Button>
    </div>
  );
}
