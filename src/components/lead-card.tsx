"use client";

import { Phone, Globe, MapPin, ChevronRight } from "lucide-react";
import type { Lead } from "@/types/lead";
import { PLANTILLA_LABEL, VIABILIDAD_LABEL } from "@/types/lead";
import { TierBadge } from "@/components/tier-badge";
import { ValidacionBadge } from "@/components/validacion-badge";

interface LeadCardProps {
  lead: Lead;
  onOpen?: (lead: Lead) => void;
  onFocus?: (lead: Lead) => void;
}

const VIAB_PILL: Record<string, string> = {
  alto: "bg-emerald-100 text-emerald-800",
  medio: "bg-amber-100 text-amber-800",
  bajo: "bg-red-100 text-red-700",
  revisar_manual: "bg-gray-100 text-gray-600",
};

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function LeadCard({ lead, onOpen, onFocus }: LeadCardProps) {
  const hasCoords =
    typeof lead.latitud === "number" && typeof lead.longitud === "number";

  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold leading-tight text-gray-900">{lead.nombre}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {lead.rubro && (
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {lead.rubro}
              </span>
            )}
            {lead.plantilla && PLANTILLA_LABEL[lead.plantilla] && (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                {PLANTILLA_LABEL[lead.plantilla]}
              </span>
            )}
            {lead.calificacion_final && lead.calificacion_final !== "sin_enriquecer" && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  VIAB_PILL[lead.calificacion_final] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                Viab. {VIABILIDAD_LABEL[lead.calificacion_final] ?? lead.calificacion_final}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <TierBadge tier={lead.tier ?? lead.pre_tier} puntaje={lead.puntaje_total ?? lead.pre_score} />
          <ValidacionBadge estado={lead.validacion_estado} motivo={lead.validacion_motivo} />
        </div>
      </div>

      {lead.direccion && (
        <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="leading-snug">{lead.direccion}</span>
        </div>
      )}

      {(lead.telefono || lead.web || hasCoords) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {lead.telefono && (
            <a
              href={`tel:${lead.telefono.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-100"
            >
              <Phone className="h-3.5 w-3.5" />
              Llamar
            </a>
          )}
          {lead.web && (
            <a
              href={normalizeUrl(lead.web)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-100"
            >
              <Globe className="h-3.5 w-3.5" />
              Sitio web
            </a>
          )}
          {hasCoords && onFocus && (
            <button
              onClick={() => onFocus(lead)}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition-colors duration-150 hover:bg-blue-100"
            >
              <MapPin className="h-3.5 w-3.5" />
              Ubicar
            </button>
          )}
        </div>
      )}

      <button
        onClick={() => onOpen?.(lead)}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-gray-100 bg-gray-50 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-800"
      >
        Ver detalle
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
