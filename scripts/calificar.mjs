/**
 * Calificador de viabilidad (Paso 4 — Compuerta 2) — Codflow
 * --------------------------------------------------------------
 * Lee las SEÑALES de cada lead y las puntúa contra su PLANTILLA para decidir
 * la viabilidad: ¿este negocio realmente encaja con la solución que vendemos?
 * v1 heurística (sin IA). La versión IA mejora el juicio cuando haya API key.
 *
 * Escribe en `leads`: viabilidad_score, calificacion_final
 *   (alto | medio | bajo | revisar_manual | sin_enriquecer), calificacion_motivo.
 *
 * USO:
 *   node scripts/calificar.mjs --dry-run
 *   node scripts/calificar.mjs --pre-tier alto
 *   node scripts/calificar.mjs --plantilla pedidos --limit 20
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(join(ROOT, file), "utf8").split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#") || !t.includes("=")) continue;
        const i = t.indexOf("=");
        const k = t.slice(0, i).trim();
        const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
        if (!(k in process.env)) process.env[k] = v;
      }
    } catch {}
  }
}
loadEnv();

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const arg = (n) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : null; };
const SOLO_PLANTILLA = arg("--plantilla");
const SOLO_PRE_TIER = arg("--pre-tier");
const LIMIT = arg("--limit") ? parseInt(arg("--limit"), 10) : null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) { console.error("✖ Falta NEXT_PUBLIC_SUPABASE_URL"); process.exit(1); }
if (!SERVICE_KEY && !DRY_RUN) { console.error("✖ Falta SUPABASE_SERVICE_ROLE_KEY (probá --dry-run)"); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY ?? "dry", { auth: { persistSession: false } });

// ---- reglas de viabilidad por plantilla (sobre las etiquetas de señales web) ----
function calificar(plantilla, senales) {
  const labels = new Set(senales.filter((s) => s.tipo === "web_senal").map((s) => s.dato));
  const nReviews = senales.filter((s) => s.tipo === "resena").length;
  const tieneWebResumen = senales.some((s) => s.tipo === "web_resumen");
  const infoSuficiente = nReviews >= 1 || tieneWebResumen;
  const has = (l) => labels.has(l);

  if (!senales.length) {
    return { viabilidad_score: null, calificacion_final: "sin_enriquecer", calificacion_motivo: "todavía sin señales (correr el enriquecedor)" };
  }
  if (!infoSuficiente) {
    return { viabilidad_score: 0, calificacion_final: "revisar_manual", calificacion_motivo: "info insuficiente (sin reseñas y web no legible)" };
  }

  let score = Math.min(nReviews, 5) * 4; // hasta 20 por volumen de reseñas (negocio real)
  const motivos = [];
  if (tieneWebResumen) score += 10;

  if (plantilla === "pedidos") {
    if (has("Usa WhatsApp como canal")) { score += 30; motivos.push("vende por WhatsApp"); }
    if (has("Enlaza Instagram")) { score += 15; motivos.push("activo en Instagram"); }
    if (has("Tiene catálogo publicado")) { score += 10; motivos.push("tiene catálogo"); }
    if (has("Tiene tienda online / e-commerce")) { score -= 15; motivos.push("ya tiene e-commerce (menos necesidad)"); }
  } else if (plantilla === "rentabilidad_logistica") {
    if (has("Maneja cotizaciones")) { score += 25; motivos.push("cotización manual = dolor"); }
    if (has("Ofrece rastreo / tracking")) { score += 5; motivos.push("opera con tracking"); }
    if (has("Antigüedad/experiencia declarada")) { score += 8; motivos.push("trayectoria declarada"); }
  } else if (plantilla === "backoffice_contable") {
    if (has("Trabajo contable/fiscal declarado")) { score += 25; motivos.push("trabajo manual contable visible"); }
    if (has("Antigüedad/experiencia declarada")) { score += 8; motivos.push("firma establecida"); }
    if (tieneWebResumen) { score += 5; }
  }

  const final = score >= 45 ? "alto" : score >= 25 ? "medio" : "bajo";
  return {
    viabilidad_score: score,
    calificacion_final: final,
    calificacion_motivo: motivos.join("; ") || "señales débiles para la plantilla",
  };
}

async function main() {
  console.log(`\n⚖️  Calificador de viabilidad (Compuerta 2) — ${DRY_RUN ? "DRY-RUN" : "ESCRIBIENDO"}` +
    `${SOLO_PLANTILLA ? ` | plantilla=${SOLO_PLANTILLA}` : ""}${SOLO_PRE_TIER ? ` | pre_tier=${SOLO_PRE_TIER}` : ""}${LIMIT ? ` | limit ${LIMIT}` : ""}\n`);

  let q = supabase.from("leads").select("id, nombre, plantilla").not("plantilla", "is", null);
  if (SOLO_PLANTILLA) q = q.eq("plantilla", SOLO_PLANTILLA);
  if (SOLO_PRE_TIER) q = q.eq("pre_tier", SOLO_PRE_TIER);
  if (LIMIT) q = q.limit(LIMIT);
  const { data: leads, error } = await q;
  if (error) { console.error("✖ Error leyendo leads:", error.message); process.exit(1); }

  // traer todas las señales de esos leads en un golpe
  const ids = leads.map((l) => l.id);
  const senalesPorLead = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const { data: ss } = await supabase.from("senales").select("lead_id, tipo, dato").in("lead_id", lote);
    for (const s of ss ?? []) {
      if (!senalesPorLead.has(s.lead_id)) senalesPorLead.set(s.lead_id, []);
      senalesPorLead.get(s.lead_id).push(s);
    }
  }

  const resumen = { alto: 0, medio: 0, bajo: 0, revisar_manual: 0, sin_enriquecer: 0 };
  for (const lead of leads) {
    const r = calificar(lead.plantilla, senalesPorLead.get(lead.id) ?? []);
    resumen[r.calificacion_final] = (resumen[r.calificacion_final] ?? 0) + 1;
    if (r.calificacion_final !== "sin_enriquecer") {
      console.log(`   ${{ alto: "🟢", medio: "🟡", bajo: "🔴", revisar_manual: "✋" }[r.calificacion_final]} ${lead.nombre}  (${r.viabilidad_score ?? "-"})  ${r.calificacion_motivo}`);
    }
    if (!DRY_RUN) {
      await supabase.from("leads").update({ ...r, calificado_at: new Date().toISOString() }).eq("id", lead.id);
    }
  }

  console.log(`\n── Resumen viabilidad ──\n` +
    `   🟢 alto:           ${resumen.alto}\n` +
    `   🟡 medio:          ${resumen.medio}\n` +
    `   🔴 bajo:           ${resumen.bajo}\n` +
    `   ✋ revisar manual: ${resumen.revisar_manual}\n` +
    `   ⚪ sin enriquecer: ${resumen.sin_enriquecer}\n` +
    (DRY_RUN ? "\n(DRY-RUN: no se escribió)\n" : "\n(Calificación guardada en leads.calificacion_final)\n"));
}

main().catch((e) => { console.error("✖ Error fatal:", e); process.exit(1); });
