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
  ChevronUp, ChevronDown, Globe, Loader2, PhoneCall
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

  useEffect(() => {
    fetchLeads();
  }, [user]);

  useEffect(() => {
    let data = [...leads];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((l) =>
        `${l.first_name} ${l.last_name} ${l.company ?? ""} ${l.email ?? ""} ${l.phone ?? ""}`.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      data = data.filter((l) => l.status === statusFilter);
    }
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
      ? sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
      : null
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-0.5">{filtered.length} lead{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" /> Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-green-700 border-green-500/40 hover:bg-green-50"
            onClick={() => {
              const leadsWithPhone = filtered.filter((l) => l.phone);
              if (leadsWithPhone.length === 0) {
                import("sonner").then(({ toast }) => toast.error("Aucun lead avec un numéro de téléphone dans la sélection actuelle."));
                return;
              }
              setCallModeLeads(leadsWithPhone);
            }}
          >
            <PhoneCall className="w-4 h-4" /> Mode appel ({filtered.filter(l => l.phone).length})
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowNewLead(true)}>
            <Plus className="w-4 h-4" /> Nouveau lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un lead..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center border border-border rounded-md overflow-hidden">
          <button
            onClick={() => setView("list")}
            className={`p-2 ${view === "list" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`p-2 ${view === "kanban" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : view === "list" ? (
        <LeadsTable leads={filtered} onSort={handleSort} SortIcon={SortIcon} onRefresh={fetchLeads} />
      ) : (
        <LeadsKanban leads={filtered} onRefresh={fetchLeads} />
      )}

      <NewLeadDialog open={showNewLead} onClose={() => setShowNewLead(false)} onCreated={fetchLeads} />
      <ImportCSVDialog open={showImport} onClose={() => setShowImport(false)} onImported={fetchLeads} />

      {callModeLeads && (
        <CallMode
          leads={callModeLeads}
          onClose={() => setCallModeLeads(null)}
          onLeadUpdated={fetchLeads}
        />
      )}
    </div>
  );
}

function LeadsTable({ leads, onSort, SortIcon, onRefresh }: any) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="font-medium">Aucun lead trouvé</p>
        <p className="text-sm mt-1">Ajoutez un lead ou importez un fichier CSV</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="cursor-pointer" onClick={() => onSort("last_name")}>
              Nom <SortIcon field="last_name" />
            </TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="cursor-pointer" onClick={() => onSort("company")}>
              Entreprise <SortIcon field="company" />
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => onSort("status")}>
              Statut <SortIcon field="status" />
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => onSort("created_at")}>
              Ajouté le <SortIcon field="created_at" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead: any) => (
            <TableRow key={lead.id} className="hover:bg-muted/30">
              <TableCell>
                <Link to={`/leads/${lead.id}`} className="flex items-center gap-2 group">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {lead.first_name?.charAt(0)}{lead.last_name?.charAt(0)}
                    </span>
                  </div>
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {lead.first_name} {lead.last_name}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <div className="space-y-0.5">
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Mail className="w-3 h-3" /> {lead.email}
                    </a>
                  )}
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Phone className="w-3 h-3" /> {lead.phone}
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p className="text-sm text-foreground">{lead.company ?? "—"}</p>
                  {lead.position && <p className="text-xs text-muted-foreground">{lead.position}</p>}
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
                      <Globe className="w-3 h-3" /> Site web
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell><StatusBadge status={lead.status} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">
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
    await supabase.from("leads").update({ status: newStatus as "nouveau" | "contacte" | "rdv_planifie" | "proposition" | "gagne" | "perdu" }).eq("id", leadId);
    onRefresh();
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
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
          <div className="flex items-center justify-between mb-3">
            <StatusBadge status={col.value} />
            <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {col.leads.length}
            </span>
          </div>
          <div className="space-y-2 min-h-[100px]">
            {col.leads.map((lead: any) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("leadId", lead.id)}
                className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
              >
                <Link to={`/leads/${lead.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-primary">
                        {lead.first_name?.charAt(0)}{lead.last_name?.charAt(0)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {lead.first_name} {lead.last_name}
                    </p>
                  </div>
                  {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
                  {lead.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
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
