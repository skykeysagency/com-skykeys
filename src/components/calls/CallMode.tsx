import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, LEAD_STATUSES } from "@/lib/leadStatus";
import { toast } from "sonner";
import NewAppointmentDialog from "@/components/appointments/NewAppointmentDialog";
import {
  Phone, PhoneOff, PhoneCall, X, ChevronRight, ChevronLeft,
  Clock, Building, Mail, Globe, MessageSquare, Calendar,
  User, Loader2, Check, NotebookPen, CalendarPlus, Mic,
  MicOff, SkipForward
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type CallStatus = "idle" | "dialing" | "in_call" | "ended";

interface CallModeProps {
  leads: any[];
  startIndex?: number;
  onClose: () => void;
  onLeadUpdated: () => void;
}

export default function CallMode({ leads, startIndex = 0, onClose, onLeadUpdated }: CallModeProps) {
  const { user } = useAuth();
  const [index, setIndex] = useState(startIndex);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [callNote, setCallNote] = useState("");
  const [outcome, setOutcome] = useState<"answered" | "voicemail" | "no_answer" | "">("");
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showAppt, setShowAppt] = useState(false);
  const [callLogged, setCallLogged] = useState(false);
  const [muted, setMuted] = useState(false);
  const [remoteHungUp, setRemoteHungUp] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playHangupSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playBeep(480, 0, 0.2);
      playBeep(380, 0.25, 0.2);
      playBeep(280, 0.5, 0.3);
    } catch {
      // Audio not supported, silently skip
    }
  };

  const lead = leads[index];
  const isFirst = index === 0;
  const isLast = index === leads.length - 1;

  useEffect(() => {
    if (lead) {
      setEditForm({
        first_name: lead.first_name ?? "",
        last_name: lead.last_name ?? "",
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        company: lead.company ?? "",
        position: lead.position ?? "",
        website: lead.website ?? "",
        status: lead.status ?? "nouveau",
        notes: lead.notes ?? "",
      });
      setCallStatus("idle");
      setCallDuration(0);
      setCallNote("");
      setOutcome("");
      setCallLogged(false);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [index, lead?.id]);

  // Timer during call
  useEffect(() => {
    if (callStatus === "in_call") {
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  // Poll Aircall every 3s while in_call to detect remote hangup
  useEffect(() => {
    if (callStatus !== "in_call") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    // Wait 5s before first check (call needs time to connect)
    const startPolling = () => {
      pollRef.current = setInterval(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await supabase.functions.invoke("aircall-dial", {
            body: { action: "check_call_status" },
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          if (res.data?.call_active === false) {
            // Remote party hung up
            setRemoteHungUp(true);
            playHangupSound();
            toast.warning("📵 Le contact a raccroché", { duration: 5000 });
            setTimeout(() => {
              setRemoteHungUp(false);
              setCallStatus("ended");
            }, 2500);
          }
        } catch {
          // Silently ignore polling errors
        }
      }, 3000);
    };
    const delay = setTimeout(startPolling, 5000);
    return () => {
      clearTimeout(delay);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [callStatus]);

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleDial = async () => {
    if (!lead?.phone) {
      toast.error("Ce lead n'a pas de numéro de téléphone");
      return;
    }
    setCallStatus("dialing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("aircall-dial", {
        body: { phone_number: lead.phone },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      const data = res.data;
      const httpStatus = data?.aircall_status;

      if (res.error) throw res.error;

      if (data?.error === "no_aircall_key") {
        toast.error("Configurez votre clé Aircall dans les Paramètres pour le click-to-call.", { duration: 6000 });
        window.open(`tel:${lead.phone}`);
      } else if (data?.error === "user_unavailable" || httpStatus === 405 || data?.details?.troubleshoot?.toLowerCase().includes("unavailable")) {
        toast.warning(
          "⚠️ Votre application Aircall Phone est fermée ou en statut « Indisponible ». Ouvrez-la et passez en « Disponible », puis réessayez.",
          { duration: 8000 }
        );
        setCallStatus("idle");
        return;
      } else if (data?.error) {
        const detail = data?.details?.message || data?.error;
        toast.error(`Erreur Aircall : ${detail} — appel via téléphone`, { duration: 5000 });
        window.open(`tel:${lead.phone}`);
      } else {
        toast.success(`📞 Appel lancé vers ${lead.phone} — décrochez Aircall Phone`, { duration: 4000 });
      }
    } catch {
      toast.error("Impossible de contacter Aircall — appel via téléphone");
      window.open(`tel:${lead.phone}`);
    }
    setCallStatus("in_call");
    setCallDuration(0);
  };

  const handleEndCall = () => {
    setCallStatus("ended");
  };

  const handleLogCall = async () => {
    if (!user || !lead) return;
    setSaving(true);
    // Save lead edits
    await supabase.from("leads").update({
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      email: editForm.email || null,
      phone: editForm.phone || null,
      company: editForm.company || null,
      position: editForm.position || null,
      website: editForm.website || null,
      status: editForm.status as any,
      notes: editForm.notes || null,
    }).eq("id", lead.id);

    // Log call
    await supabase.from("call_logs").insert({
      user_id: user.id,
      lead_id: lead.id,
      notes: callNote || null,
      status: outcome || "completed",
      duration_seconds: callDuration,
    });

    // Activity log
    const outcomeLabel: Record<string, string> = {
      answered: "Répondu", voicemail: "Messagerie vocale", no_answer: "Pas de réponse", "": "Appel"
    };
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      lead_id: lead.id,
      type: "appel",
      content: `${outcomeLabel[outcome] || "Appel"} (${formatDuration(callDuration)})${callNote ? ` — ${callNote}` : ""}`,
    });

    toast.success("Appel enregistré !");
    setCallLogged(true);
    onLeadUpdated();
    setSaving(false);
  };

  const handleSaveEdits = async () => {
    if (!lead || !user) return;
    setSaving(true);
    const { error } = await supabase.from("leads").update({
      first_name: editForm.first_name, last_name: editForm.last_name,
      email: editForm.email || null, phone: editForm.phone || null,
      company: editForm.company || null, position: editForm.position || null,
      website: editForm.website || null, status: editForm.status as any,
      notes: editForm.notes || null,
    }).eq("id", lead.id);
    if (!error) { toast.success("Lead mis à jour"); onLeadUpdated(); }
    setSaving(false);
  };

  const goNext = () => {
    if (!isLast) { setIndex(index + 1); }
    else { toast.info("Tous les leads ont été traités 🎉"); onClose(); }
  };
  const goPrev = () => { if (!isFirst) setIndex(index - 1); };

  if (!lead) return null;

  const callRingColors: Record<CallStatus, string> = {
    idle: "border-border",
    dialing: "border-amber-400 animate-pulse",
    in_call: "border-green-500",
    ended: "border-muted",
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-semibold text-foreground">Mode appel</span>
            <Badge variant="outline" className="text-xs">
              {index + 1} / {leads.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goPrev} disabled={isFirst} className="gap-1 text-xs">
              <ChevronLeft className="w-3.5 h-3.5" /> Précédent
            </Button>
            <Button variant="ghost" size="sm" onClick={goNext} className="gap-1 text-xs">
              {isLast ? "Terminer" : "Suivant"} <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Lead info + édition */}
          <div className="w-80 shrink-0 border-r border-border overflow-y-auto bg-card">
            <div className="p-5 space-y-5">
              {/* Avatar + nom */}
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-full border-4 ${callRingColors[callStatus]} flex items-center justify-center bg-primary/10 shrink-0 transition-all`}>
                  <span className="text-xl font-bold text-primary">
                    {editForm.first_name?.charAt(0)}{editForm.last_name?.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-foreground text-base">
                    {editForm.first_name} {editForm.last_name}
                  </p>
                  {editForm.company && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building className="w-3 h-3" /> {editForm.company}
                    </p>
                  )}
                </div>
              </div>

              {/* Statut lead */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Statut pipeline</label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Champs éditables */}
              <div className="space-y-2.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Informations</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Prénom" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className="h-8 text-sm" />
                  <Input placeholder="Nom" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className="h-8 text-sm" />
                </div>
                <Input placeholder="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="h-8 text-sm" />
                <Input placeholder="Téléphone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="h-8 text-sm" />
                <Input placeholder="Entreprise" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} className="h-8 text-sm" />
                <Input placeholder="Poste" value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} className="h-8 text-sm" />
                <Input placeholder="Site web" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} className="h-8 text-sm" />
              </div>

              {/* Notes lead */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes lead</label>
                <Textarea
                  placeholder="Notes sur ce lead..."
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="text-sm resize-none"
                />
              </div>

              <Button size="sm" variant="outline" onClick={handleSaveEdits} disabled={saving} className="w-full gap-1.5 text-xs">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Sauvegarder les modifications
              </Button>
            </div>
          </div>

          {/* Center: Appel */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 overflow-y-auto">
            {/* Phone number */}
            <div className="text-center">
              <p className="text-4xl font-bold text-foreground tracking-widest mb-1">
                {editForm.phone || "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                {lead.company ? `${lead.first_name} ${lead.last_name} · ${lead.company}` : `${lead.first_name} ${lead.last_name}`}
              </p>
            </div>

            {/* Remote hangup alert */}
            {remoteHungUp && (
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-destructive/10 border border-destructive/30 animate-pulse">
                <PhoneOff className="w-5 h-5 text-destructive shrink-0" />
                <div>
                  <p className="font-semibold text-destructive text-sm">Le contact a raccroché</p>
                  <p className="text-xs text-muted-foreground">Passage au résumé de l'appel…</p>
                </div>
              </div>
            )}

            {/* Call status indicator */}
            {callStatus === "dialing" && (
              <div className="flex items-center gap-2 text-amber-600 font-medium text-sm animate-pulse">
                <PhoneCall className="w-4 h-4" /> Appel en cours de connexion...
              </div>
            )}
            {callStatus === "in_call" && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  En communication
                </div>
                <p className="text-2xl font-mono font-bold text-foreground tabular-nums">
                  {formatDuration(callDuration)}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMuted(!muted)}
                  className={`gap-1.5 text-xs ${muted ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {muted ? "Micro coupé" : "Couper le micro"}
                </Button>
              </div>
            )}

            {/* Call buttons */}
            <div className="flex items-center gap-4">
              {callStatus === "idle" && (
                <button
                  onClick={handleDial}
                  disabled={!editForm.phone}
                  className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 disabled:bg-muted disabled:cursor-not-allowed text-white flex items-center justify-center shadow-lg shadow-green-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  <Phone className="w-8 h-8" />
                </button>
              )}
              {(callStatus === "dialing" || callStatus === "in_call") && (
                <button
                  onClick={handleEndCall}
                  className="w-20 h-20 rounded-full bg-destructive hover:bg-destructive/90 text-white flex items-center justify-center shadow-lg shadow-destructive/30 transition-all hover:scale-105 active:scale-95"
                >
                  <PhoneOff className="w-8 h-8" />
                </button>
              )}
            </div>

            {/* Post-call section */}
            {callStatus === "ended" && !callLogged && (
              <div className="w-full max-w-md space-y-4 bg-card border border-border rounded-xl p-5 shadow-sm">
                <p className="font-semibold text-foreground flex items-center gap-2">
                  <NotebookPen className="w-4 h-4 text-primary" /> Résumé de l'appel
                </p>

                {/* Duration */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  Durée : <span className="font-mono font-semibold text-foreground">{formatDuration(callDuration)}</span>
                </div>

                {/* Outcome */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Résultat de l'appel</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: "answered", label: "✅ Répondu", color: "border-green-500 text-green-700 bg-green-50" },
                      { value: "voicemail", label: "📩 Messagerie", color: "border-amber-400 text-amber-700 bg-amber-50" },
                      { value: "no_answer", label: "❌ Pas de réponse", color: "border-destructive text-destructive bg-red-50" },
                    ].map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setOutcome(o.value as any)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${outcome === o.value ? o.color : "border-border text-muted-foreground hover:bg-muted"}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Note sur l'appel</label>
                  <Textarea
                    placeholder="Résumé de l'échange, prochaines étapes..."
                    rows={3}
                    value={callNote}
                    onChange={(e) => setCallNote(e.target.value)}
                    className="text-sm resize-none"
                    autoFocus
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs flex-1"
                    onClick={() => setShowAppt(true)}
                  >
                    <CalendarPlus className="w-3.5 h-3.5" /> Planifier un RDV
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs flex-1"
                    onClick={handleLogCall}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Enregistrer l'appel
                  </Button>
                </div>
              </div>
            )}

            {callLogged && (
              <div className="w-full max-w-md bg-green-50 border border-green-200 rounded-xl p-5 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-green-800">Appel enregistré !</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowAppt(true)}>
                    <CalendarPlus className="w-3.5 h-3.5" /> Planifier un RDV
                  </Button>
                  <Button size="sm" className="gap-1.5 text-xs" onClick={goNext}>
                    {isLast ? "Terminer" : "Lead suivant"} <SkipForward className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Navigation rapide entre leads */}
          <div className="w-64 shrink-0 border-l border-border overflow-y-auto bg-card/50">
            <div className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                File d'appels ({leads.length})
              </p>
              <div className="space-y-1">
                {leads.map((l, i) => (
                  <button
                    key={l.id}
                    onClick={() => setIndex(i)}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors text-sm flex items-center gap-2.5
                      ${i === index ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"}
                    `}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                      ${i === index ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}
                    `}>
                      {l.first_name?.charAt(0)}{l.last_name?.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium text-xs truncate ${i === index ? "text-white" : ""}`}>
                        {l.first_name} {l.last_name}
                      </p>
                      {l.phone && (
                        <p className={`text-[10px] truncate ${i === index ? "text-white/70" : "text-muted-foreground"}`}>
                          {l.phone}
                        </p>
                      )}
                    </div>
                    {i < index && (
                      <Check className={`w-3.5 h-3.5 shrink-0 ${i === index ? "text-white" : "text-green-500"}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <NewAppointmentDialog
        open={showAppt}
        onClose={() => setShowAppt(false)}
        onCreated={() => { toast.success("RDV créé depuis le mode appel !"); onLeadUpdated(); }}
        defaultLeadId={lead.id}
        defaultLeadName={`${lead.first_name} ${lead.last_name}`}
      />
    </>
  );
}
