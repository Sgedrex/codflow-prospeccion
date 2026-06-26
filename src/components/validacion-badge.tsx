import { ShieldCheck, AlertTriangle, Ban, HelpCircle, Shield } from "lucide-react";
import type { ValidacionEstado } from "@/types/lead";
import { getValidacionStyle, normalizeValidacion } from "@/lib/validacion-colors";

interface ValidacionBadgeProps {
  estado: string | null;
  motivo?: string | null;
}

const ICONS: Record<ValidacionEstado, typeof ShieldCheck> = {
  operativo: ShieldCheck,
  dudoso: AlertTriangle,
  cerrado: Ban,
  no_encontrado: HelpCircle,
  sin_validar: Shield,
};

export function ValidacionBadge({ estado, motivo }: ValidacionBadgeProps) {
  const style = getValidacionStyle(estado);
  const norm = normalizeValidacion(estado) ?? "sin_validar";
  const Icon = ICONS[norm];

  return (
    <span
      title={motivo ?? undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.badgeClass}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {style.label}
    </span>
  );
}
