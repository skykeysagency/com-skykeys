import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ShieldCheck, Users, CalendarDays, Plus, Pencil, Trash2,
  Loader2, Search, Building2, Phone, Mail,
  Clock, MapPin, User, ExternalLink, UserPlus, Lock, Layers,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// ── Types ─────────────────────────────────────────────
type LeadStatus = "nouveau" | "contacte" | "rdv_planifie" | "proposition" | "gagne" | "perdu";

const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string; class: string }[] = [
  { value: "nouveau",      label: "Nouveau",      class: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "contacte",     label: "Contacté",     class: "bg-violet-50 text-violet-700 border-violet-200" },
  { value: "rdv_planifie", label: "RDV planifié", class: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "proposition",  label: "Proposition",  class: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "gagne",        label: "Gagné",        class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "perdu",        label: "Perdu",        class: "bg-rose-50 text-rose-700 border-rose-200" },
];

const EMPTY_LEAD = {
  first_name: "", last_name: "", email: "", phone: "",
  company: "", position: "", website: "", notes: "",
  status: "nouveau" as LeadStatus,
};

const EMPTY_APT = {
  title: "", start_at: "", end_at: "", location: "", notes: "", lead_id: "",
};

function toDatetimeLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Field component ────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

// ── Status badge ───────────────────────────────────────
function StatusBadge({ status }: { status: LeadStatus }) {
  const opt = LEAD_STATUS_OPTIONS.find((o) => o.value === status);
  if (!opt) return null;
  return <Badge variant="outline" className={`text-[11px] font-semibold px-2 py-0.5 ${opt.class}`}>{opt.label}</Badge>;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { isManager, loadingRole } = useRole();
  const navigate = useNavigate();

  // ── Leads state ────────────────────────────────────
  const [leads, setLeads] = useState<any[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadDialog, setLeadDialog] = useState<"create" | "edit" | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD);
  const [savingLead, setSavingLead] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);

  // ── Appointments state ─────────────────────────────
  const [appointments, setAppointments] = useState<any[]>([]);
  const [aptSearch, setAptSearch] = useState("");
  const [loadingApts, setLoadingApts] = useState(false);
  const [aptDialog, setAptDialog] = useState(false);
  const [editingApt, setEditingApt] = useState<any | null>(null);
  const [aptForm, setAptForm] = useState(EMPTY_APT);
  const [savingApt, setSavingApt] = useState(false);
  const [deletingAptId, setDeletingAptId] = useState<string | null>(null);

  // ── User creation state ────────────────────────────
  const EMPTY_USER_FORM = { email: "", password: "", first_name: "", last_name: "", role: "commercial" as "admin" | "manager" | "commercial" };
  const [userDialog, setUserDialog] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [savingUser, setSavingUser] = useState(false);

  // ── Users list state ───────────────────────────────
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingUserLeadsId, setDeletingUserLeadsId] = useState<string | null>(null);
  const [deletingUserLeadsName, setDeletingUserLeadsName] = useState<string>("");
  const [deletingUserLeadsCount, setDeletingUserLeadsCount] = useState<number>(0);
  const [isDeletingLeads, setIsDeletingLeads] = useState(false);

  useEffect(() => {
    if (!loadingRole && !isManager) navigate("/", { replace: true });
  }, [loadingRole, isManager]);

  useEffect(() => {
    if (isManager) { fetchLeads(); fetchAppointments(); fetchUsers(); }
  }, [isManager]);

  // ── Fetch ──────────────────────────────────────────
  const fetchLeads = async () => {
    setLoadingLeads(true);
    const { data } = await supabase.from("leads")
      .select("*")
      .order("last_name");
    setLeads(data ?? []);
    setLoadingLeads(false);
  };

  const fetchAppointments = async () => {
    setLoadingApts(true);
    const { data } = await supabase.from("appointments")
      .select("*, leads(first_name, last_name, company)")
      .order("start_at", { ascending: false });
    setAppointments(data ?? []);
    setLoadingApts(false);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, email");
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");
    const { data: leadsData } = await supabase
      .from("leads")
      .select("user_id");

    const leadCountByUser: Record<string, number> = {};
    (leadsData ?? []).forEach((l: any) => {
      leadCountByUser[l.user_id] = (leadCountByUser[l.user_id] ?? 0) + 1;
    });

    const roleMap: Record<string, string> = {};
    (roles ?? []).forEach((r: any) => { roleMap[r.user_id] = r.role; });

    const list = (profiles ?? []).map((p: any) => ({
      ...p,
      role: roleMap[p.user_id] ?? "commercial",
      leads_count: leadCountByUser[p.user_id] ?? 0,
    }));
    setUsersList(list);
    setLoadingUsers(false);
  };

  const deleteAllLeadsForUser = async () => {
    if (!deletingUserLeadsId) return;
    setIsDeletingLeads(true);
    const { error } = await supabase.from("leads").delete().eq("user_id", deletingUserLeadsId);
    if (error) toast.error("Erreur lors de la suppression des leads");
    else {
      toast.success(`Tous les leads de ${deletingUserLeadsName} ont été supprimés`);
      fetchLeads();
      fetchUsers();
    }
    setDeletingUserLeadsId(null);
    setIsDeletingLeads(false);
  };

  // ── Lead CRUD ──────────────────────────────────────
  const openCreateLead = () => {
    setLeadForm(EMPTY_LEAD);
    setEditingLead(null);
    setLeadDialog("create");
  };

  const openEditLead = (lead: any) => {
    setEditingLead(lead);
    setLeadForm({
      first_name: lead.first_name ?? "",
      last_name: lead.last_name ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      company: lead.company ?? "",
      position: lead.position ?? "",
      website: lead.website ?? "",
      notes: lead.notes ?? "",
      status: lead.status as LeadStatus,
    });
    setLeadDialog("edit");
  };

  const saveLead = async () => {
    if (!user) return;
    setSavingLead(true);
    const payload = {
      first_name: leadForm.first_name,
      last_name: leadForm.last_name,
      email: leadForm.email || null,
      phone: leadForm.phone || null,
      company: leadForm.company || null,
      position: leadForm.position || null,
      website: leadForm.website || null,
      notes: leadForm.notes || null,
      status: leadForm.status,
    };

    if (leadDialog === "create") {
      const { error } = await supabase.from("leads").insert([{ ...payload, user_id: user.id }]);
      if (error) toast.error("Erreur lors de la création");
      else { toast.success("Lead créé !"); fetchLeads(); setLeadDialog(null); }
    } else if (editingLead) {
      const { error } = await supabase.from("leads").update(payload).eq("id", editingLead.id);
      if (error) toast.error("Erreur lors de la modification");
      else { toast.success("Lead modifié !"); fetchLeads(); setLeadDialog(null); }
    }
    setSavingLead(false);
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) toast.error("Erreur lors de la suppression");
    else { toast.success("Lead supprimé"); fetchLeads(); }
    setDeletingLeadId(null);
  };

  // ── Appointment CRUD ───────────────────────────────
  const openEditApt = (apt: any) => {
    setEditingApt(apt);
    setAptForm({
      title: apt.title ?? "",
      start_at: toDatetimeLocal(apt.start_at),
      end_at: toDatetimeLocal(apt.end_at),
      location: apt.location ?? "",
      notes: apt.notes ?? "",
      lead_id: apt.lead_id ?? "",
    });
    setAptDialog(true);
  };

  const saveApt = async () => {
    if (!editingApt) return;
    setSavingApt(true);
    const payload = {
      title: aptForm.title,
      start_at: aptForm.start_at,
      end_at: aptForm.end_at || aptForm.start_at,
      location: aptForm.location || null,
      notes: aptForm.notes || null,
      lead_id: aptForm.lead_id || null,
    };
    const { error } = await supabase.from("appointments").update(payload).eq("id", editingApt.id);
    if (error) toast.error("Erreur lors de la modification");
    else { toast.success("Rendez-vous modifié !"); fetchAppointments(); setAptDialog(false); }
    setSavingApt(false);
  };

  const deleteApt = async (id: string) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) toast.error("Erreur lors de la suppression");
    else { toast.success("Rendez-vous supprimé"); fetchAppointments(); }
    setDeletingAptId(null);
  };

  // ── Create user ────────────────────────────────────
  const saveUser = async () => {
    setSavingUser(true);
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(userForm),
    });
    const result = await resp.json();
    if (!resp.ok) {
      toast.error(result.error ?? "Erreur lors de la création");
    } else {
      toast.success(`Compte créé pour ${userForm.email}`);
      setUserDialog(false);
      setUserForm(EMPTY_USER_FORM);
    }
    setSavingUser(false);
  };

  // ── Filters ────────────────────────────────────────
  const filteredLeads = leads.filter((l) => {
    const q = leadSearch.toLowerCase();
    return (
      l.first_name?.toLowerCase().includes(q) ||
      l.last_name?.toLowerCase().includes(q) ||
      l.company?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q)
    );
  });

  const filteredApts = appointments.filter((a) => {
    const q = aptSearch.toLowerCase();
    return (
      a.title?.toLowerCase().includes(q) ||
      a.leads?.first_name?.toLowerCase().includes(q) ||
      a.leads?.last_name?.toLowerCase().includes(q) ||
      a.location?.toLowerCase().includes(q)
    );
  });

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between shrink-0 border-b border-border bg-card shadow-card">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-primary shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Administration</h1>
            <p className="text-sm text-muted-foreground font-medium">Gestion complète des leads et rendez-vous</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs font-semibold border-primary/30 text-primary bg-primary/5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Accès administrateur
        </Badge>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <Tabs defaultValue="leads">
          <TabsList className="mb-6 bg-muted p-1 rounded-xl">
            <TabsTrigger value="leads" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Users className="w-4 h-4" /> Leads
              <span className="ml-1 text-[11px] font-bold text-muted-foreground">({leads.length})</span>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <CalendarDays className="w-4 h-4" /> Rendez-vous
              <span className="ml-1 text-[11px] font-bold text-muted-foreground">({appointments.length})</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <UserPlus className="w-4 h-4" /> Utilisateurs
            </TabsTrigger>
          </TabsList>

          {/* ── LEADS TAB ── */}
          <TabsContent value="leads">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un lead…"
                  className="pl-9 h-9 text-sm"
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
              </div>
              <Button size="sm" className="gap-1.5 shadow-primary text-xs font-semibold" onClick={openCreateLead}>
                <Plus className="w-3.5 h-3.5" /> Créer un lead
              </Button>
            </div>

            {loadingLeads ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-card shadow-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Lead</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Contact</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Entreprise</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Statut</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">Aucun lead trouvé</td></tr>
                    ) : filteredLeads.map((lead, i) => (
                      <tr
                        key={lead.id}
                        className={`border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/5"}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0 shadow-primary">
                              {lead.first_name?.[0]?.toUpperCase()}{lead.last_name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{lead.first_name} {lead.last_name}</p>
                              {lead.position && <p className="text-[11px] text-muted-foreground">{lead.position}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="space-y-0.5">
                            {lead.email && (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="w-3 h-3" /> {lead.email}
                              </p>
                            )}
                            {lead.phone && (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="w-3 h-3" /> {lead.phone}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {lead.company && (
                            <p className="flex items-center gap-1 text-xs font-medium text-foreground">
                              <Building2 className="w-3 h-3 text-muted-foreground" /> {lead.company}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={lead.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost" size="icon"
                              className="w-8 h-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                              onClick={() => navigate(`/leads/${lead.id}`)}
                              title="Voir la fiche"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="w-8 h-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                              onClick={() => openEditLead(lead)}
                              title="Modifier"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => setDeletingLeadId(lead.id)}
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── APPOINTMENTS TAB ── */}
          <TabsContent value="appointments">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un rendez-vous…"
                  className="pl-9 h-9 text-sm"
                  value={aptSearch}
                  onChange={(e) => setAptSearch(e.target.value)}
                />
              </div>
            </div>

            {loadingApts ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-card shadow-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Rendez-vous</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Date & Heure</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Prospect</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Lieu</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApts.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">Aucun rendez-vous trouvé</td></tr>
                    ) : filteredApts.map((apt, i) => (
                      <tr
                        key={apt.id}
                        className={`border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/5"}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <CalendarDays className="w-4 h-4 text-primary" />
                            </div>
                            <p className="font-semibold text-foreground">{apt.title}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="flex items-center gap-1 text-xs font-medium text-foreground">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {format(parseISO(apt.start_at), "d MMM yyyy", { locale: fr })}
                          </p>
                          <p className="text-[11px] text-muted-foreground ml-4">
                            {format(parseISO(apt.start_at), "HH:mm")} – {format(parseISO(apt.end_at), "HH:mm")}
                          </p>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {apt.leads ? (
                            <p className="flex items-center gap-1 text-xs font-medium text-foreground">
                              <User className="w-3 h-3 text-muted-foreground" />
                              {apt.leads.first_name} {apt.leads.last_name}
                              {apt.leads.company && <span className="text-muted-foreground"> — {apt.leads.company}</span>}
                            </p>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Aucun prospect</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {apt.location ? (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" /> {apt.location}
                            </p>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost" size="icon"
                              className="w-8 h-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                              onClick={() => openEditApt(apt)}
                              title="Modifier / Déplacer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => setDeletingAptId(apt.id)}
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── USERS TAB ── */}
          <TabsContent value="users">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Comptes utilisateurs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">L'inscription publique est désactivée — seul l'admin peut créer des comptes.</p>
              </div>
              <Button size="sm" className="gap-1.5 shadow-primary text-xs font-semibold" onClick={() => setUserDialog(true)}>
                <UserPlus className="w-3.5 h-3.5" /> Créer un compte
              </Button>
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : usersList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Accès sur invitation uniquement</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Cliquez sur "Créer un compte" pour inviter un commercial ou un manager.
                </p>
                <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs" onClick={() => setUserDialog(true)}>
                  <UserPlus className="w-3.5 h-3.5" /> Créer un premier compte
                </Button>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-card shadow-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Utilisateur</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Rôle</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Leads</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u, i) => {
                      const roleLabel = u.role === "admin" ? "Admin" : u.role === "manager" ? "Manager" : "Commercial";
                      const roleClass = u.role === "admin"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : u.role === "manager"
                          ? "bg-violet-50 text-violet-700 border-violet-200"
                          : "bg-blue-50 text-blue-700 border-blue-200";
                      const initials = `${u.first_name?.[0] ?? ""}${u.last_name?.[0] ?? ""}`.toUpperCase() || u.email?.[0]?.toUpperCase() || "?";
                      return (
                        <tr key={u.user_id} className={`border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0 shadow-primary">
                                {initials}
                              </div>
                              <p className="font-semibold text-foreground">
                                {u.first_name || u.last_name ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() : <span className="text-muted-foreground italic">Sans nom</span>}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3" /> {u.email ?? "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-[11px] font-semibold px-2 py-0.5 ${roleClass}`}>{roleLabel}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                              {u.leads_count}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={u.leads_count === 0}
                                className="h-7 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 disabled:opacity-40"
                                onClick={() => {
                                  setDeletingUserLeadsId(u.user_id);
                                  setDeletingUserLeadsName(`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email || "cet utilisateur");
                                  setDeletingUserLeadsCount(u.leads_count);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                                Supprimer les leads
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>

      {/* ── Lead dialog (create / edit) ── */}
      <Dialog open={!!leadDialog} onOpenChange={(o) => !o && setLeadDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-primary">
                <Users className="w-4 h-4 text-primary-foreground" />
              </div>
              {leadDialog === "create" ? "Créer un lead" : "Modifier le lead"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prénom *">
                <Input placeholder="Jean" value={leadForm.first_name} onChange={(e) => setLeadForm({ ...leadForm, first_name: e.target.value })} />
              </Field>
              <Field label="Nom *">
                <Input placeholder="Dupont" value={leadForm.last_name} onChange={(e) => setLeadForm({ ...leadForm, last_name: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <Input type="email" placeholder="jean@société.fr" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} />
              </Field>
              <Field label="Téléphone">
                <Input placeholder="+33 6 00 00 00 00" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Entreprise">
                <Input placeholder="Acme SAS" value={leadForm.company} onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })} />
              </Field>
              <Field label="Poste">
                <Input placeholder="Directeur commercial" value={leadForm.position} onChange={(e) => setLeadForm({ ...leadForm, position: e.target.value })} />
              </Field>
            </div>
            <Field label="Site web">
              <Input placeholder="https://acme.fr" value={leadForm.website} onChange={(e) => setLeadForm({ ...leadForm, website: e.target.value })} />
            </Field>
            <Field label="Statut pipeline">
              <Select value={leadForm.status} onValueChange={(v) => setLeadForm({ ...leadForm, status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea placeholder="Notes sur ce lead…" rows={3} value={leadForm.notes} onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })} />
            </Field>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setLeadDialog(null)}>Annuler</Button>
            <Button
              disabled={savingLead || !leadForm.first_name || !leadForm.last_name}
              onClick={saveLead}
              className="shadow-primary"
            >
              {savingLead ? <Loader2 className="w-4 h-4 animate-spin" /> : leadDialog === "create" ? "Créer le lead" : "Enregistrer les modifications"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Appointment dialog (edit / move) ── */}
      <Dialog open={aptDialog} onOpenChange={(o) => !o && setAptDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-primary">
                <CalendarDays className="w-4 h-4 text-primary-foreground" />
              </div>
              Modifier le rendez-vous
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <Field label="Titre *">
              <Input placeholder="Démonstration produit" value={aptForm.title} onChange={(e) => setAptForm({ ...aptForm, title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Début *">
                <Input
                  type="datetime-local"
                  value={aptForm.start_at}
                  onChange={(e) => setAptForm({ ...aptForm, start_at: e.target.value })}
                />
              </Field>
              <Field label="Fin">
                <Input
                  type="datetime-local"
                  value={aptForm.end_at}
                  onChange={(e) => setAptForm({ ...aptForm, end_at: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Lieu / Lien visio">
              <Input placeholder="Bureau, Zoom, Teams…" value={aptForm.location} onChange={(e) => setAptForm({ ...aptForm, location: e.target.value })} />
            </Field>
            <Field label="Associer à un lead">
              <Select value={aptForm.lead_id || "none"} onValueChange={(v) => setAptForm({ ...aptForm, lead_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Aucun prospect" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun prospect</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.first_name} {l.last_name}{l.company ? ` — ${l.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea placeholder="Notes sur le RDV…" rows={2} value={aptForm.notes} onChange={(e) => setAptForm({ ...aptForm, notes: e.target.value })} />
            </Field>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAptDialog(false)}>Annuler</Button>
            <Button
              disabled={savingApt || !aptForm.title || !aptForm.start_at}
              onClick={saveApt}
              className="shadow-primary"
            >
              {savingApt ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete lead confirm ── */}
      <AlertDialog open={!!deletingLeadId} onOpenChange={(o) => !o && setDeletingLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce lead ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées (activités, appels) seront supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingLeadId && deleteLead(deletingLeadId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete appointment confirm ── */}
      <AlertDialog open={!!deletingAptId} onOpenChange={(o) => !o && setDeletingAptId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rendez-vous ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingAptId && deleteApt(deletingAptId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete all leads for user confirm ── */}
      <AlertDialog open={!!deletingUserLeadsId} onOpenChange={(o) => !o && setDeletingUserLeadsId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer tous les leads de {deletingUserLeadsName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement <strong>{deletingUserLeadsCount} lead{deletingUserLeadsCount > 1 ? "s" : ""}</strong> ainsi que toutes les données associées (activités, appels, rendez-vous liés). Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingLeads}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteAllLeadsForUser}
              disabled={isDeletingLeads}
            >
              {isDeletingLeads ? <Loader2 className="w-4 h-4 animate-spin" /> : `Supprimer les ${deletingUserLeadsCount} leads`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create user dialog ── */}
      <Dialog open={userDialog} onOpenChange={(o) => !o && setUserDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-primary">
                <UserPlus className="w-4 h-4 text-primary-foreground" />
              </div>
              Créer un compte utilisateur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom">
                <Input placeholder="Jean" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} />
              </Field>
              <Field label="Nom">
                <Input placeholder="Dupont" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} />
              </Field>
            </div>
            <Field label="Email *">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" placeholder="jean@société.fr" className="pl-9" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
              </div>
            </Field>
            <Field label="Mot de passe *">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" placeholder="Min. 6 caractères" className="pl-9" minLength={6} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
              </div>
            </Field>
            <Field label="Rôle">
              <Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v as "admin" | "manager" | "commercial" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setUserDialog(false)}>Annuler</Button>
            <Button
              disabled={savingUser || !userForm.email || !userForm.password}
              onClick={saveUser}
              className="shadow-primary"
            >
              {savingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer le compte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
