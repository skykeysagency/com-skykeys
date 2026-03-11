// Lead status utilities shared across components
export const LEAD_STATUSES = [
  { value: "nouveau", label: "Nouveau", color: "status-nouveau" },
  { value: "contacte", label: "Contacté", color: "status-contacte" },
  { value: "rdv_planifie", label: "RDV planifié", color: "status-rdv_planifie" },
  { value: "proposition", label: "Proposition", color: "status-proposition" },
  { value: "gagne", label: "Gagné", color: "status-gagne" },
  { value: "perdu", label: "Perdu", color: "status-perdu" },
] as const;

export type LeadStatus = typeof LEAD_STATUSES[number]["value"];

export function getStatusLabel(status: string) {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const s = LEAD_STATUSES.find((s) => s.value === status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s?.color ?? ""}`}>
      {s?.label ?? status}
    </span>
  );
}
