import type { Lead } from "@/types/lead";
import { LeadCard } from "@/components/lead-card";

interface LeadsGridProps {
  leads: Lead[];
  onOpen?: (lead: Lead) => void;
  onFocus?: (lead: Lead) => void;
}

export function LeadsGrid({ leads, onOpen, onFocus }: LeadsGridProps) {
  if (leads.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
        No hay prospectos que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} onOpen={onOpen} onFocus={onFocus} />
      ))}
    </div>
  );
}
