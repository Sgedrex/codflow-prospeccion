import type { LeadKpis } from "@/lib/leads-utils";

interface KpiCardProps {
  label: string;
  value: string;
  accent?: "default" | "alto" | "medio" | "bajo" | "operativo" | "revisar";
}

const ACCENT_CLASSES: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  default: "text-gray-900",
  alto: "text-emerald-600",
  medio: "text-amber-600",
  bajo: "text-gray-500",
  operativo: "text-emerald-600",
  revisar: "text-orange-600",
};

function KpiCard({ label, value, accent = "default" }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${ACCENT_CLASSES[accent]}`}>
        {value}
      </p>
    </div>
  );
}

interface KpiRowProps {
  kpis: LeadKpis;
}

export function KpiRow({ kpis }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard label="Total de prospectos" value={String(kpis.total)} />
      <KpiCard label="Operativos" value={String(kpis.operativos)} accent="operativo" />
      <KpiCard label="Por revisar" value={String(kpis.porRevisar)} accent="revisar" />
      <KpiCard label="Tier alto" value={String(kpis.alto)} accent="alto" />
      <KpiCard
        label="Puntaje promedio"
        value={kpis.promedio !== null ? kpis.promedio.toFixed(1) : "—"}
      />
    </div>
  );
}
