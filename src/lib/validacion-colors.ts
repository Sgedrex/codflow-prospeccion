import type { ValidacionEstado } from "@/types/lead";

interface ValidacionStyle {
  label: string;
  badgeClass: string;
  dotClass: string;
  mapColor: string;
}

const VALIDACION_STYLES: Record<ValidacionEstado, ValidacionStyle> = {
  operativo: {
    label: "Operativo",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
    mapColor: "#16a34a",
  },
  dudoso: {
    label: "Revisar",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
    dotClass: "bg-orange-500",
    mapColor: "#ea580c",
  },
  cerrado: {
    label: "Cerrado",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    dotClass: "bg-red-500",
    mapColor: "#dc2626",
  },
  no_encontrado: {
    label: "No hallado",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-300",
    dotClass: "bg-gray-400",
    mapColor: "#6b7280",
  },
  sin_validar: {
    label: "Sin validar",
    badgeClass: "bg-slate-50 text-slate-500 border-slate-200",
    dotClass: "bg-slate-300",
    mapColor: "#94a3b8",
  },
};

const FALLBACK_STYLE: ValidacionStyle = VALIDACION_STYLES.sin_validar;

export function normalizeValidacion(
  raw: string | null | undefined
): ValidacionEstado | null {
  if (!raw) return null;
  const n = raw.toLowerCase().trim();
  if (
    n === "operativo" ||
    n === "dudoso" ||
    n === "cerrado" ||
    n === "no_encontrado" ||
    n === "sin_validar"
  ) {
    return n;
  }
  return null;
}

export function getValidacionStyle(raw: string | null | undefined): ValidacionStyle {
  const estado = normalizeValidacion(raw);
  return estado ? VALIDACION_STYLES[estado] : FALLBACK_STYLE;
}

// Orden para el filtro: primero lo que requiere atención
export const VALIDACION_ORDER: ValidacionEstado[] = [
  "operativo",
  "dudoso",
  "cerrado",
  "no_encontrado",
  "sin_validar",
];
