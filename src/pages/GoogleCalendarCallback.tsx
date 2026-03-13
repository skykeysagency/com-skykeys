import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GoogleCalendarCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      setStatus("error");
      setMessage("Autorisation refusée par Google.");
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("Code d'autorisation manquant.");
      return;
    }

    exchangeCode(code);
  }, []);

  const exchangeCode = async (code: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-exchange`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ code, redirect_uri: `${window.location.origin}/google-auth-callback` }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) {
        setStatus("error");
        setMessage(result.error || "Erreur lors de l'échange du code OAuth.");
      } else {
        setStatus("success");
        setMessage("Google Calendar connecté avec succès ! Vos rendez-vous peuvent maintenant créer des liens Google Meet.");
        setTimeout(() => navigate("/settings"), 3000);
      }
    } catch {
      setStatus("error");
      setMessage("Erreur réseau lors de la connexion.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-card space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="font-semibold text-foreground">Connexion à Google Calendar…</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="font-bold text-foreground text-lg">Connecté !</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground">Redirection dans 3 secondes…</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="font-bold text-foreground text-lg">Erreur</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button onClick={() => navigate("/settings")} variant="outline" size="sm">
              Retour aux paramètres
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
