import { Search } from "lucide-react";
import type { LeadFilters } from "@/lib/leads-utils";
import { TIER_ORDER, getTierStyle } from "@/lib/tier-colors";
import { VALIDACION_ORDER, getValidacionStyle } from "@/lib/validacion-colors";
import { PLANTILLA_LABEL, VIABILIDAD_LABEL, VIABILIDAD_ORDER } from "@/types/lead";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const ALL_VALUE = "__all__";

interface FiltersBarProps {
  filters: LeadFilters;
  onFiltersChange: (filters: LeadFilters) => void;
  rubros: string[];
  resultCount: number;
  totalCount: number;
}

export function FiltersBar({
  filters,
  onFiltersChange,
  rubros,
  resultCount,
  totalCount,
}: FiltersBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar por nombre..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-8"
          />
        </div>

        <Select
          value={filters.plantilla ?? ALL_VALUE}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, plantilla: value === ALL_VALUE ? null : value })
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Plantilla" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas las plantillas</SelectItem>
            {Object.entries(PLANTILLA_LABEL).map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.viabilidad ?? ALL_VALUE}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, viabilidad: value === ALL_VALUE ? null : value })
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Viabilidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Toda viabilidad</SelectItem>
            {VIABILIDAD_ORDER.map((v) => (
              <SelectItem key={v} value={v}>
                {VIABILIDAD_LABEL[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.rubro ?? ALL_VALUE}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, rubro: value === ALL_VALUE ? null : value })
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Rubro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos los rubros</SelectItem>
            {rubros.map((rubro) => (
              <SelectItem key={rubro} value={rubro}>
                {rubro}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.tier ?? ALL_VALUE}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, tier: value === ALL_VALUE ? null : value })
          }
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos los tiers</SelectItem>
            {TIER_ORDER.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {getTierStyle(tier).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.validacion ?? ALL_VALUE}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, validacion: value === ALL_VALUE ? null : value })
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Validación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Toda validación</SelectItem>
            {VALIDACION_ORDER.map((estado) => (
              <SelectItem key={estado} value={estado}>
                {getValidacionStyle(estado).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-gray-500">
        <span className="tabular-nums whitespace-nowrap">
          Mostrando {resultCount} de {totalCount}
        </span>
      </div>
    </div>
  );
}
