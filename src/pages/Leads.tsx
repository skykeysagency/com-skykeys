import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, LEAD_STATUSES } from "@/lib/leadStatus";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Search, Upload, LayoutGrid, List, Phone, Mail,
  ChevronUp, ChevronDown, Globe, Loader2, PhoneCall, Users
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import NewLeadDialog from "@/components/leads/NewLeadDialog";
import ImportCSVDialog from "@/components/leads/ImportCSVDialog";
import CallMode from "@/components/calls/CallMode";

type SortDir = "asc" | "desc";

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showNewLead, setShowNewLead] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [callModeLeads, setCallModeLeads] = useState<any[] | null>(null);

  useEffect(() => { fetchLeads(); }, [user]);

  useEffect(() => {
    let data = [...leads];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((l) =>
        `${l.first_name} ${l.last_name} ${l.company ?? ""} ${l.email ?? ""} ${l.phone ?? ""}`.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") data = data.filter((l) => l.status === statusFilter);
    data.sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      return sortDir === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
    setFiltered(data);
  }, [leads, search, statusFilter, sortField, sortDir]);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads(data ?? []);
    setLoading(false);
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    sortField === field
      ? sortDir === "asc"
        ? <ChevronUp className="w-3 h-3 inline ml-1 text-primary" />
        : <ChevronDown className="w-3 h-3 inline ml-1 text-primary" />
      : null
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Pipeline</p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Leads</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9"
            onClick={() => setShowImport(true)}
          >
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9 text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
            onClick={() => {
              const leadsWithPhone = filtered.filter((l) => l.phone);
              if (leadsWithPhone.length === 0) {
                import("sonner").then(({ toast }) => toast.error("Aucun lead avec un numéro de téléphone."));
                return;
              }
              setCallModeLeads(leadsWithPhone);
            }}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Mode appel
            <span className="ml-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {filtered.filter(l => l.phone).length}
            </span>
          </Button>
          <Button size="sm" className="gap-2 h-9 shadow-primary gradient-primary text-white border-0 hover:opacity-90" onClick={() => setShowNewLead(true)}>
            <Plus className="w-3.5 h-3.5" /> Nouveau lead
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Rechercher un lead..."
            className="pl-9 h-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9 bg-card">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden h-9">
          <button
            onClick={() => setView("list")}
            className={`px-3 h-full flex items-center justify-center transition-colors ${view === "list" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-border" />
          <button
            onClick={() => setView("kanban")}
            className={`px-3 h-full flex items-center justify-center transition-colors ${view === "kanban" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
        <span className="text-xs text-muted-foreground font-medium ml-1">
          {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Chargement des leads…</p>
          </div>
        </div>
      ) : view === "list" ? (
        <LeadsTable leads={filtered} onSort={handleSort} SortIcon={SortIcon} onRefresh={fetchLeads} />
      ) : (
        <LeadsKanban leads={filtered} onRefresh={fetchLeads} />
      )}

      <NewLeadDialog open={showNewLead} onClose={() => setShowNewLead(false)} onCreated={fetchLeads} />
      <ImportCSVDialog open={showImport} onClose={() => setShowImport(false)} onImported={fetchLeads} />

      {callModeLeads && (
        <CallMode leads={callModeLeads} onClose={() => setCallModeLeads(null)} onLeadUpdated={fetchLeads} />
      )}
    </div>
  );
}

function LeadsTable({ leads, onSort, SortIcon, onRefresh }: any) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-2xl">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Users className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="font-semibold text-foreground">Aucun lead trouvé</p>
        <p className="text-sm text-muted-foreground mt-1">Ajoutez un lead ou importez un fichier CSV</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border">
            <TableHead className="cursor-pointer select-none font-semibold text-foreground/70 text-xs uppercase tracking-wide py-3" onClick={() => onSort("last_name")}>
              Nom <SortIcon field="last_name" />
            </TableHead>
            <TableHead className="font-semibold text-foreground/70 text-xs uppercase tracking-wide">Contact</TableHead>
            <TableHead className="cursor-pointer select-none font-semibold text-foreground/70 text-xs uppercase tracking-wide" onClick={() => onSort("company")}>
              Entreprise <SortIcon field="company" />
            </TableHead>
            <TableHead className="cursor-pointer select-none font-semibold text-foreground/70 text-xs uppercase tracking-wide" onClick={() => onSort("status")}>
              Statut <SortIcon field="status" />
            </TableHead>
            <TableHead className="cursor-pointer select-none font-semibold text-foreground/70 text-xs uppercase tracking-wide" onClick={() => onSort("created_at")}>
              Ajouté le <SortIcon field="created_at" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead: any) => (
            <TableRow key={lead.id} className="hover:bg-accent/40 transition-colors border-b border-border/50 last:border-0">
              <TableCell className="py-3">
                <Link to={`/leads/${lead.id}`} className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-primary">
                    {lead.first_name?.charAt(0)}{lead.last_name?.charAt(0)}
                  </div>
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                    {lead.first_name} {lead.last_name}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="py-3">
                <div className="space-y-0.5">
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Mail className="w-3 h-3 shrink-0" /> {lead.email}
                    </a>
                  )}
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Phone className="w-3 h-3 shrink-0" /> {lead.phone}
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{lead.company ?? "—"}</p>
                  {lead.position && <p className="text-xs text-muted-foreground">{lead.position}</p>}
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
                      <Globe className="w-3 h-3" /> Site web
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-3"><StatusBadge status={lead.status} /></TableCell>
              <TableCell className="py-3 text-xs text-muted-foreground font-medium">
                {format(new Date(lead.created_at), "d MMM yyyy", { locale: fr })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LeadsKanban({ leads, onRefresh }: any) {
  const columns = LEAD_STATUSES.map((s) => ({
    ...s,
    leads: leads.filter((l: any) => l.status === s.value),
  }));

  const handleDrop = async (leadId: string, newStatus: string) => {
    await supabase.from("leads").update({ status: newStatus as any }).eq("id", leadId);
    onRefresh();
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
      {columns.map((col) => (
        <div
          key={col.value}
          className="flex-shrink-0 w-64"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("leadId");
            if (id) handleDrop(id, col.value);
          }}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <StatusBadge status={col.value} />
            <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full px-2.5 py-1">
              {col.leads.length}
            </span>
          </div>
          <div className="space-y-2.5 min-h-[80px]">
            {col.leads.map((lead: any) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("leadId", lead.id)}
                className="bg-card border border-border rounded-xl p-3.5 cursor-grab active:cursor-grabbing shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group"
              >
                <Link to={`/leads/${lead.id}`}>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-primary">
                      {lead.first_name?.charAt(0)}{lead.last_name?.charAt(0)}
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {lead.first_name} {lead.last_name}
                    </p>
                  </div>
                  {lead.company && (
                    <p className="text-xs text-muted-foreground font-medium">{lead.company}</p>
                  )}
                  {lead.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                      <Phone className="w-3 h-3" /> {lead.phone}
                    </p>
                  )}
                </Link>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
