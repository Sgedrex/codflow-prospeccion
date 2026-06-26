import type { Tier } from "@/types/lead";

interface TierStyle {
  label: string;
  badgeClass: string;
  dotClass: string;
  mapColor: string;
}

const TIER_STYLES: Record<Tier, TierStyle> = {
  alto: {
    label: "Alto",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
    mapColor: "#16a34a",
  },
  medio: {
    label: "Medio",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
    mapColor: "#d97706",
  },
  bajo: {
    label: "Bajo",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
    dotClass: "bg-gray-400",
    mapColor: "#6b7280",
  },
};

const FALLBACK_STYLE: TierStyle = {
  label: "Sin tier",
  badgeClass: "bg-gray-50 text-gray-500 border-gray-200",
  dotClass: "bg-gray-300",
  mapColor: "#9ca3af",
};

export function normalizeTier(rawTier: string | null | undefined): Tier | null {
  if (!rawTier) return null;
  const normalized = rawTier.toLowerCase().trim();
  if (normalized === "alto" || normalized === "medio" || normalized === "bajo") {
    return normalized;
  }
  return null;
}

export function getTierStyle(rawTier: string | null | undefined): TierStyle {
  const tier = normalizeTier(rawTier);
  return tier ? TIER_STYLES[tier] : FALLBACK_STYLE;
}

export const TIER_ORDER: Tier[] = ["alto", "medio", "bajo"];
