import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TrendingUp, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

type Mode = "login" | "forgot";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    if (error) toast.error("Email ou mot de passe incorrect.");
    else navigate("/");
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else { toast.success("Email de réinitialisation envoyé !"); setMode("login"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[hsl(var(--sidebar-bg))] text-white p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">CommercialCRM</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight mb-6">
            Gérez vos leads,<br />
            <span className="text-primary">signez plus de deals.</span>
          </h1>
          <p className="text-[hsl(var(--sidebar-fg))] text-lg leading-relaxed">
            Import CSV, suivi du pipeline, RDV intégrés et appels Aircall — tout en un.
          </p>

          <div className="mt-10 space-y-4">
            {[
              "Import de leads depuis CSV/Excel",
              "Pipeline Kanban par statut",
              "Calendrier de rendez-vous intégré",
              "Appels click-to-call via Aircall",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-[hsl(var(--sidebar-fg))]">
                <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-[hsl(var(--sidebar-fg))] opacity-60">
          © 2024 CommercialCRM — Tous droits réservés
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">CommercialCRM</span>
          </div>

          {mode === "login" && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground">Bon retour 👋</h2>
                <p className="text-muted-foreground mt-1">Connectez-vous à votre espace</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" name="email" type="email" placeholder="vous@exemple.com" className="pl-9" value={form.email} onChange={handleChange} required />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" name="password" type="password" placeholder="••••••••" className="pl-9" value={form.password} onChange={handleChange} required />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => setMode("forgot")} className="text-sm text-primary hover:underline">
                    Mot de passe oublié ?
                  </button>
                </div>
                <Button type="submit" className="w-full shadow-primary" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Se connecter <ArrowRight className="w-4 h-4 ml-1" /></>}
                </Button>
              </form>
            </>
          )}

          {mode === "forgot" && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground">Mot de passe oublié</h2>
                <p className="text-muted-foreground mt-1">Nous vous enverrons un lien de réinitialisation</p>
              </div>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email-forgot">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email-forgot" name="email" type="email" placeholder="vous@exemple.com" className="pl-9" value={form.email} onChange={handleChange} required />
                  </div>
                </div>
                <Button type="submit" className="w-full shadow-primary" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer le lien"}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-6">
                <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                  ← Retour à la connexion
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
