import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, User, Phone, Key, Check, Shield, Mail, Briefcase, ExternalLink, Video, CheckCircle2, Link2 } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", position: "", aircall_api_key: "" });
  const [showKey, setShowKey] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [checkingGoogle, setCheckingGoogle] = useState(false);

  useEffect(() => { fetchProfile(); }, [user]);
  useEffect(() => { if (isAdmin) checkGoogleConnection(); }, [isAdmin]);

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

  const checkGoogleConnection = async () => {
    setCheckingGoogle(true);
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "google_refresh_token")
      .single();
    setGoogleConnected(!!data?.value);
    setCheckingGoogle(false);
  };

  const connectGoogle = () => {
    const clientId = "487021133980-t6s24vsvukf8rl86sfg7v1rtlsnpn56i.apps.googleusercontent.com";
    const redirectUri = `${window.location.origin}/google-auth-callback`;
    const scope = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ].join(" ");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scope);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    window.location.href = url.toString();
  };

  const disconnectGoogle = async () => {
    await supabase.from("app_settings").delete().eq("key", "google_refresh_token");
    setGoogleConnected(false);
    toast.success("Google Calendar déconnecté");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("user_id", user.id);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      setSaving(false);
      return;
    }
    // Sync first_name / last_name into auth user_metadata so the sidebar reflects the change immediately
    await supabase.auth.updateUser({
      data: { first_name: form.first_name, last_name: form.last_name },
    });
    toast.success("Paramètres sauvegardés !");
    setSaving(false);
  };

  const initials = `${form.first_name?.charAt(0) ?? ""}${form.last_name?.charAt(0) ?? ""}`.toUpperCase() || user?.email?.charAt(0).toUpperCase() || "?";

  if (loading) return (
    <div className="flex items-center justify-center h-full py-24">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-2xl space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gérez votre profil et vos intégrations</p>
      </div>

      {/* ── Profile card ── */}
      <Card className="border-border shadow-card">
        <CardHeader className="pb-4 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Profil
          </CardTitle>
          <CardDescription>Vos informations personnelles</CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] flex items-center justify-center text-primary-foreground font-bold text-lg shadow-primary">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {form.first_name || form.last_name ? `${form.first_name} ${form.last_name}`.trim() : "Nom non défini"}
              </p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-4">
            <FieldBlock label="Prénom" icon={<User className="w-3.5 h-3.5" />}>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="Jean"
              />
            </FieldBlock>
            <FieldBlock label="Nom" icon={<User className="w-3.5 h-3.5" />}>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Dupont"
              />
            </FieldBlock>
          </div>

          <FieldBlock label="Email" icon={<Mail className="w-3.5 h-3.5" />}>
            <Input value={user?.email ?? ""} disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
          </FieldBlock>

          <FieldBlock label="Poste" icon={<Briefcase className="w-3.5 h-3.5" />}>
            <Input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="Commercial, Directeur des ventes…"
            />
          </FieldBlock>
        </CardContent>
      </Card>

      {/* ── Aircall card ── */}
      <Card className="border-border shadow-card">
        <CardHeader className="pb-4 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" /> Intégration Aircall
          </CardTitle>
          <CardDescription>
            Activez le click-to-call depuis les fiches leads et le mode appel.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <FieldBlock label="Clé API Aircall" icon={<Key className="w-3.5 h-3.5" />}>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={form.aircall_api_key}
                onChange={(e) => setForm({ ...form, aircall_api_key: e.target.value })}
                placeholder="api_id:api_token"
                className="pr-16"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? "Masquer" : "Afficher"}
              </button>
            </div>
          </FieldBlock>

          {/* Instructions */}
          <div className="rounded-xl bg-accent border border-accent-foreground/10 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-accent-foreground flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Configuration requise
            </p>
            <p className="text-xs text-muted-foreground">
              Format : <code className="bg-background px-1.5 py-0.5 rounded font-mono border border-border">api_id:api_token</code>
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Connectez-vous à <a href="https://dashboard.aircall.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">dashboard.aircall.io <ExternalLink className="w-3 h-3" /></a></li>
              <li>Allez dans <strong className="text-foreground">Intégrations → API Keys</strong></li>
              <li>Copiez l'<strong className="text-foreground">API ID</strong> et l'<strong className="text-foreground">API Token</strong></li>
              <li>Saisissez : <code className="bg-background px-1 rounded font-mono border border-border">votre_api_id:votre_api_token</code></li>
            </ol>
          </div>

          {form.aircall_api_key && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-3 h-3 text-green-600" />
              </div>
              Clé API configurée — le click-to-call est activé
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Google Calendar card (admin only) ── */}
      {isAdmin && (
        <Card className="border-border shadow-card">
          <CardHeader className="pb-4 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" /> Intégration Google Calendar & Meet
            </CardTitle>
            <CardDescription>
              Connectez votre compte Google pour créer des liens Google Meet automatiquement lors de la création de RDV.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {checkingGoogle ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Vérification de la connexion…
              </div>
            ) : googleConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-800">Google Calendar connecté</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Les RDV créés peuvent générer un lien Google Meet et envoyer les invitations.</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={disconnectGoogle}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Déconnecter Google Calendar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-accent border border-accent-foreground/10 p-4 space-y-2">
                  <p className="text-xs font-semibold text-accent-foreground flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Connexion requise
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cliquez sur le bouton ci-dessous pour autoriser Sky Call à créer des événements dans votre Google Calendar et générer des liens Meet.
                  </p>
                </div>
                <Button
                  onClick={connectGoogle}
                  className="gap-2 shadow-primary"
                  size="sm"
                >
                  <Video className="w-4 h-4" />
                  Connecter Google Calendar
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Save button ── */}
      <div className="flex justify-end pt-1">
        <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-primary min-w-[160px]">
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde…</>
          ) : (
            <><Check className="w-4 h-4" /> Sauvegarder</>
          )}
        </Button>
      </div>
    </div>
  );
}

function FieldBlock({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}
