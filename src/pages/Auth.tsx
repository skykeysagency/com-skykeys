import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, Loader2, BarChart3, Users, Calendar, Phone } from "lucide-react";
import skyCallLogo from "@/assets/skycall-logo.png";

type Mode = "login" | "forgot";

const features = [
  { icon: Users, label: "Gestion des leads", desc: "Pipeline Kanban en temps réel" },
  { icon: Calendar, label: "Rendez-vous intégrés", desc: "Calendrier synchronisé" },
  { icon: Phone, label: "Click-to-call Aircall", desc: "Appels depuis le CRM" },
  { icon: BarChart3, label: "Tableau de bord", desc: "KPIs et analytics" },
];

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
    <div className="min-h-screen flex bg-background">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, hsl(225 35% 10%) 0%, hsl(234 60% 16%) 50%, hsl(225 35% 10%) 100%)" }}>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "48px 48px"
          }} />

        {/* Glow blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, hsl(234 89% 60%) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-[320px] h-[320px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, hsl(250 95% 72%) 0%, transparent 70%)" }} />

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src={skyCallLogo} alt="Sky Call" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold text-white tracking-tight">Sky Call</span>
          </div>

          {/* Hero text */}
          <div className="mt-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 border text-xs font-medium"
              style={{ background: "hsl(234 89% 60% / 0.15)", borderColor: "hsl(234 89% 60% / 0.3)", color: "hsl(234 89% 80%)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Plateforme commerciale tout-en-un
            </div>

            <h1 className="text-5xl font-bold text-white leading-[1.15] mb-5 tracking-tight">
              Gérez vos leads,<br />
              <span style={{ background: "var(--gradient-primary)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                signez plus de deals.
              </span>
            </h1>
            <p className="text-lg leading-relaxed" style={{ color: "hsl(220 20% 65%)" }}>
              Import CSV, pipeline Kanban, RDV intégrés<br />et appels Aircall — tout en un seul espace.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label}
                className="flex items-start gap-3 p-4 rounded-xl border transition-colors"
                style={{ background: "hsl(225 35% 14% / 0.8)", borderColor: "hsl(225 25% 20%)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "hsl(234 89% 60% / 0.2)", border: "1px solid hsl(234 89% 60% / 0.3)" }}>
                  <Icon className="w-4 h-4" style={{ color: "hsl(234 89% 72%)" }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "hsl(220 15% 55%)" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-xs" style={{ color: "hsl(220 15% 40%)" }}>
            © 2024 Sky Call — Tous droits réservés
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Subtle background accent */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] opacity-[0.03] pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, hsl(234 89% 60%), transparent 70%)" }} />

        <div className="w-full max-w-[380px] relative z-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-foreground">Sky Call</span>
          </div>

          {mode === "login" && (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Bon retour 👋</h2>
                <p className="text-muted-foreground mt-2">Connectez-vous à votre espace commercial</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="email" name="email" type="email"
                      placeholder="vous@exemple.com"
                      className="pl-10 h-11 bg-background border-border focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.email} onChange={handleChange} required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">Mot de passe</Label>
                    <button type="button" onClick={() => setMode("forgot")}
                      className="text-xs font-medium text-primary hover:underline underline-offset-4 transition-colors">
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password" name="password" type="password"
                      placeholder="••••••••"
                      className="pl-10 h-11 bg-background border-border focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.password} onChange={handleChange} required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 text-sm font-semibold shadow-primary mt-2" disabled={loading}>
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><span>Se connecter</span><ArrowRight className="w-4 h-4 ml-1" /></>
                  }
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-7">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-background text-xs text-muted-foreground">accès sécurisé</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
                {["SSL 256-bit", "RGPD compliant", "Données EU"].map((t) => (
                  <span key={t} className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-green-500" />
                    {t}
                  </span>
                ))}
              </div>
            </>
          )}

          {mode === "forgot" && (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: "hsl(234 89% 96%)", border: "1px solid hsl(234 89% 85%)" }}>
                  <Mail className="w-5 h-5" style={{ color: "hsl(234 89% 50%)" }} />
                </div>
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Mot de passe oublié</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                </p>
              </div>

              <form onSubmit={handleForgot} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email-forgot" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="email-forgot" name="email" type="email"
                      placeholder="vous@exemple.com"
                      className="pl-10 h-11 bg-background border-border"
                      value={form.email} onChange={handleChange} required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 font-semibold shadow-primary" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer le lien de réinitialisation"}
                </Button>
              </form>

              <button onClick={() => setMode("login")}
                className="mt-6 flex items-center gap-1.5 text-sm text-primary font-medium hover:underline underline-offset-4 mx-auto">
                <ArrowRight className="w-4 h-4 rotate-180" />
                Retour à la connexion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
