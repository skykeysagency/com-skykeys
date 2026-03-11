import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, FileText, CheckCircle, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const EXPECTED_FIELDS = [
  { key: "first_name", label: "Prénom *", required: true },
  { key: "last_name", label: "Nom *", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Téléphone" },
  { key: "company", label: "Entreprise" },
  { key: "position", label: "Poste" },
  { key: "website", label: "Site internet" },
  { key: "source", label: "Source" },
  { key: "notes", label: "Notes" },
];

const AUTO_MAP: Record<string, string[]> = {
  first_name: ["prénom", "prenom", "firstname", "first_name", "first name", "nom"],
  last_name: ["nom", "lastname", "last_name", "last name", "surname"],
  email: ["email", "e-mail", "mail", "courriel"],
  phone: ["téléphone", "telephone", "phone", "tel", "mobile", "gsm"],
  company: ["entreprise", "société", "societe", "company", "organization", "organisation"],
  position: ["poste", "titre", "fonction", "position", "job title", "title"],
  website: ["site", "website", "url", "site web", "site internet"],
  source: ["source", "provenance", "origine", "origin"],
  notes: ["notes", "note", "commentaires", "commentaire", "remarks"],
};

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const rows = lines.slice(1).map((line) =>
    line.split(sep).map((cell) => cell.trim().replace(/^["']|["']$/g, ""))
  );
  return { headers, rows };
}

export default function ImportCSV() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [importCount, setImportCount] = useState(0);

  const handleFileRead = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      setHeaders(h);
      setRows(r);
      // Auto-map columns
      const autoMapping: Record<string, string> = {};
      EXPECTED_FIELDS.forEach(({ key }) => {
        const candidates = AUTO_MAP[key] ?? [];
        const match = h.find((header) =>
          candidates.some((c) => header.toLowerCase().includes(c))
        );
        if (match) autoMapping[key] = match;
      });
      setMapping(autoMapping);
      setStep("map");
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileRead(file);
  };

  const getMappedRows = () =>
    rows.map((row) => {
      const obj: Record<string, string> = {};
      EXPECTED_FIELDS.forEach(({ key }) => {
        const col = mapping[key];
        if (col) {
          const idx = headers.indexOf(col);
          if (idx !== -1) obj[key] = row[idx] ?? "";
        }
      });
      return obj;
    }).filter((r) => r.first_name || r.last_name);

  const handleImport = async () => {
    if (!user) return;
    setLoading(true);
    const data = getMappedRows().map((r) => ({
      user_id: user.id,
      first_name: r.first_name || "—",
      last_name: r.last_name || "—",
      email: r.email || null,
      phone: r.phone || null,
      company: r.company || null,
      position: r.position || null,
      website: r.website || null,
      source: r.source || null,
      notes: r.notes || null,
      status: "nouveau" as const,
    }));
    const { error } = await supabase.from("leads").insert(data);
    if (error) {
      toast.error("Erreur lors de l'import : " + error.message);
    } else {
      setImportCount(data.length);
      setStep("done");
      toast.success(`${data.length} leads importés avec succès !`);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/leads")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import CSV / Excel</h1>
          <p className="text-muted-foreground mt-0.5">Importez vos leads depuis un fichier CSV ou Excel</p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {["upload", "map", "preview", "done"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === s ? "bg-primary text-white" : ["upload", "map", "preview", "done"].indexOf(step) > i ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              {i + 1}
            </div>
            {i < 3 && <div className={`w-8 h-0.5 ${["upload", "map", "preview", "done"].indexOf(step) > i ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {step === "upload" && "Chargement du fichier"}
          {step === "map" && "Correspondance des colonnes"}
          {step === "preview" && "Aperçu & confirmation"}
          {step === "done" && "Import terminé"}
        </span>
      </div>

      {step === "upload" && (
        <Card className="border-border shadow-none">
          <CardContent className="p-8">
            <div
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-accent transition-all"
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <p className="font-semibold text-foreground">Glissez votre fichier ici</p>
              <p className="text-sm text-muted-foreground mt-1">ou cliquez pour sélectionner un fichier CSV / Excel</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])}
              />
            </div>
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium text-foreground mb-2">Colonnes reconnues automatiquement :</p>
              <div className="flex flex-wrap gap-2">
                {EXPECTED_FIELDS.map((f) => (
                  <span key={f.key} className="text-xs bg-card border border-border px-2 py-1 rounded-md text-muted-foreground">
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "map" && (
        <Card className="border-border shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4" /> {fileName} — {rows.length} lignes détectées
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {EXPECTED_FIELDS.map(({ key, label, required }) => (
              <div key={key} className="flex items-center gap-4">
                <Label className="w-40 text-sm text-right shrink-0">
                  {label}
                  {required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Select
                  value={mapping[key] ?? "__none__"}
                  onValueChange={(v) => setMapping({ ...mapping, [key]: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="— Ne pas importer —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Ne pas importer —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mapping[key] && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("upload")}>Retour</Button>
              <Button onClick={() => setStep("preview")} disabled={!mapping.first_name && !mapping.last_name}>
                Aperçu ({getMappedRows().length} leads)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card className="border-border shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Aperçu — {getMappedRows().length} leads à importer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden mb-4 max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {EXPECTED_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <TableHead key={f.key} className="text-xs">{f.label.replace(" *", "")}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getMappedRows().slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      {EXPECTED_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                        <TableCell key={f.key} className="text-xs py-2">{row[f.key] || "—"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {getMappedRows().length > 10 && (
              <p className="text-xs text-muted-foreground mb-4">... et {getMappedRows().length - 10} autres lignes</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>Retour</Button>
              <Button onClick={handleImport} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Importer {getMappedRows().length} leads
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card className="border-border shadow-none">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Import réussi !</h2>
            <p className="text-muted-foreground mb-6">{importCount} leads ont été importés avec succès.</p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => { setStep("upload"); setFileName(""); setHeaders([]); setRows([]); }}>
                Importer un autre fichier
              </Button>
              <Button onClick={() => navigate("/leads")}>
                Voir mes leads
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`font-medium text-sm ${className ?? ""}`}>{children}</label>;
}
