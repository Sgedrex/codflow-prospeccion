"use client";

import { useMemo, useState } from "react";
import type { Lead } from "@/types/lead";
import { fetchLeads } from "@/lib/supabase";
import {
  EMPTY_FILTERS,
  computeKpis,
  filterLeads,
  getUniqueRubros,
  leadsWithCoordinates,
  type LeadFilters,
} from "@/lib/leads-utils";
import { KpiRow } from "@/components/kpi-row";
import { FiltersBar } from "@/components/filters-bar";
import { LeadsGrid } from "@/components/leads-grid";
import { LeadsMap } from "@/components/leads-map";
import { LeadModal } from "@/components/lead-modal";
import { RefreshCw } from "lucide-react";

interface DashboardProps {
  initialLeads: Lead[];
}

export function Dashboard({ initialLeads }: DashboardProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_FILTERS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusLead, setFocusLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  function openLead(lead: Lead) {
    setSelectedLead(lead);
    setFocusLead(lead); // al abrir el detalle, también ubicar en el mapa
  }

  const rubros = useMemo(() => getUniqueRubros(leads), [leads]);
  const filteredLeads = useMemo(() => filterLeads(leads, filters), [leads, filters]);
  const kpis = useMemo(() => computeKpis(leads), [leads]);
  const mapLeads = useMemo(() => leadsWithCoordinates(filteredLeads), [filteredLeads]);

  async function handleRefresh() {
    setIsRefreshing(true);
    setError(null);
    try {
      const fresh = await fetchLeads();
      setLeads(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar desde Supabase.");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Prospección Codflow
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Leads calificados de empresas en Ciudad de Panamá
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </header>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6">
        <KpiRow kpis={kpis} />
      </div>

      <div className="mt-6">
        <FiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          rubros={rubros}
          resultCount={filteredLeads.length}
          totalCount={leads.length}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <LeadsGrid leads={filteredLeads} onOpen={openLead} onFocus={setFocusLead} />
        <div className="xl:sticky xl:top-6 xl:self-start">
          <LeadsMap leads={mapLeads} focusLead={focusLead} />
        </div>
      </div>

      <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
