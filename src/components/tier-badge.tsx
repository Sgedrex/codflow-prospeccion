import { getTierStyle } from "@/lib/tier-colors";

interface TierBadgeProps {
  tier: string | null;
  puntaje: number | null;
}

export function TierBadge({ tier, puntaje }: TierBadgeProps) {
  const style = getTierStyle(tier);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dotClass}`} />
      {style.label}
      {typeof puntaje === "number" && (
        <span className="tabular-nums font-semibold">{Math.round(puntaje)}</span>
      )}
    </span>
  );
}
