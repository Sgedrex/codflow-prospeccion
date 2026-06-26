"use client";

import { useEffect, useState } from "react";
import { X, Phone, Globe, MapPin, Lightbulb, AlertTriangle, Star, Globe2 } from "lucide-react";
import type { Lead } from "@/types/lead";
import { PLANTILLA_LABEL, VIABILIDAD_LABEL } from "@/types/lead";
import { TierBadge } from "@/components/tier-badge";
import { ValidacionBadge } from "@/components/validacion-badge";
import { supabase } from "@/lib/supabase";

interface Senal {
  id: string;
  tipo: string;
  dato: string;
  fuente: string;
  fecha: string | null;
  confianza: string | null;
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

export function LeadModal({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const [senales, setSenales] = useState<Senal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lead) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead, onClose]);

  useEffect(() => {
    if (!lead || !supabase) {
      setSenales([]);
      return;
    }
    setLoading(true);
    supabase
      .from("senales")
      .select("*")
      .eq("lead_id", lead.id)
      .then(({ data }) => {
        setSenales((data as Senal[]) ?? []);
        setLoading(false);
      });
  }, [lead]);

  if (!lead) return null;

  const resenas = senales.filter((s) => s.tipo === "resena");
  const webSenales = senales.filter((s) => s.tipo === "web_senal");
  const webResumen = senales.find((s) => s.tipo === "web_resumen");
  const webDiag = senales.find((s) => s.tipo === "web_diag");
  const calif = lead.calificacion_final;
  const tieneViab = calif && calif !== "sin_enriquecer";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold leading-tight text-gray-900">{lead.nombre}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TierBadge tier={lead.tier ?? lead.pre_tier} puntaje={lead.puntaje_total ?? lead.pre_score} />
            <ValidacionBadge estado={lead.validacion_estado} motivo={lead.validacion_motivo} />
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Contacto */}
        <div className="mt-4 space-y-2">
          {lead.direccion && (
            <div className="flex items-start gap-2 text-xs text-gray-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span>{lead.direccion}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {lead.telefono && (
              <a
                href={`tel:${lead.telefono.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                <Phone className="h-3.5 w-3.5" /> {lead.telefono}
              </a>
            )}
            {lead.web && (
              <a
                href={normalizeUrl(lead.web)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                <Globe className="h-3.5 w-3.5" /> Sitio web
              </a>
            )}
          </div>
        </div>

        {/* ¿Por qué esta viabilidad? */}
        {tieneViab && (
          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Viabilidad:</span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${VIAB_PILL[calif] ?? "bg-gray-100 text-gray-600"}`}
              >
                {VIABILIDAD_LABEL[calif] ?? calif}
              </span>
              {typeof lead.viabilidad_score === "number" && (
                <span className="text-xs text-gray-400">score {lead.viabilidad_score}</span>
              )}
            </div>
            {lead.calificacion_motivo && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-medium">Por qué:</span> {lead.calificacion_motivo}
              </p>
            )}
            <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Basado en estas señales:
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {webSenales.map((s) => (
                <span key={s.id} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                  {s.dato}
                </span>
              ))}
              {resenas.length > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                  {resenas.length} reseñas analizadas
                </span>
              )}
              {webSenales.length === 0 && resenas.length === 0 && (
                <span className="text-[11px] text-gray-400">sin señales web relevantes</span>
              )}
            </div>
          </div>
        )}

        {/* Inteligencia (señal + ángulo) si existe */}
        {lead.senal_destacada && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="text-xs leading-snug text-amber-800">{lead.senal_destacada}</p>
          </div>
        )}
        {lead.angulo_contacto && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
            <p className="text-xs italic leading-snug text-gray-600">{lead.angulo_contacto}</p>
          </div>
        )}
        {!lead.senal_destacada && !lead.angulo_contacto && (
          <div className="mt-4 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-xs text-gray-400">
            <span className="font-medium text-gray-500">Propuesta de contacto:</span> aún no generada —
            se crea con el agente de IA a partir de la evidencia de abajo.
          </div>
        )}

        {/* Señales recolectadas */}
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-gray-700">Evidencia recolectada</h3>
          {loading && <p className="mt-2 text-xs text-gray-400">Cargando señales…</p>}
          {!loading && senales.length === 0 && (
            <p className="mt-2 text-xs text-gray-400">
              Sin señales todavía — este prospecto aún no fue enriquecido.
            </p>
          )}

          {webDiag && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
              <Globe2 className="h-3.5 w-3.5" /> {webDiag.dato}
            </p>
          )}

          {webResumen && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700">
                Resumen del sitio web
              </summary>
              <p className="mt-1.5 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
                {webResumen.dato}
              </p>
            </details>
          )}

          {resenas.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Reseñas de Google
              </p>
              {resenas.map((r) => (
                <div key={r.id} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <p className="text-xs leading-snug text-gray-700">{r.dato}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
