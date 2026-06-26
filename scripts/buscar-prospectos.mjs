/**
 * Buscador de Prospectos — Codflow (reemplazo de la capa de descubrimiento de MiroFish)
 * ------------------------------------------------------------------------------------
 * Encuentra empresas nuevas en Google Maps por rubro × zona de Ciudad de Panamá,
 * las deduplica contra las que ya tenés, y las inserta en `leads` ya pre-validadas.
 * FILTRO (calificación): solo guarda negocios OPERATIVOS y CONTACTABLES (teléfono o web).
 * No filtra por rating ni nº de reseñas — trae establecidos y "con dolor" por igual
 * (perfil mixto); el scoring los ordena después. NO genera scoring/inteligencia (otra capa).
 *
 * USO:
 *   node scripts/buscar-prospectos.mjs --dry-run                 # prueba, no escribe
 *   node scripts/buscar-prospectos.mjs --rubro clinica --zona "El Dorado" --dry-run
 *   node scripts/buscar-prospectos.mjs                           # corre todo y escribe
 *   node scripts/buscar-prospectos.mjs --pages 2                 # más resultados por combo
 *
 * FLAGS:
 *   --dry-run        no escribe en Supabase, solo reporta
 *   --rubro <key>    limita a un rubro (logistica|clinica|contable|importadora|distribucion)
 *   --zona "<n>"     limita a una zona (ej. "Costa del Este")
 *   --pages <n>      páginas de Maps por combo (20 resultados c/u, default 1, máx 3)
 *
 * REQUIERE en .env.local: GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
      const raw = readFileSync(join(ROOT, file), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#") || !t.includes("=")) continue;
        const i = t.indexOf("=");
        const k = t.slice(0, i).trim();
        const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
        if (!(k in process.env)) process.env[k] = v;
      }
    } catch {
      /* puede no existir */
    }
  }
}
loadEnv();

// ---------- flags ----------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};
const SOLO_RUBRO = arg("--rubro");
const SOLO_ZONA = arg("--zona");
const PAGES = Math.min(parseInt(arg("--pages") || "1", 10), 3);

// ---------- config ----------
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MAPS_KEY || !SUPABASE_URL) {
  console.error("✖ Falta GOOGLE_MAPS_API_KEY o NEXT_PUBLIC_SUPABASE_URL en .env.local");
  process.exit(1);
}
if (!SERVICE_KEY && !DRY_RUN) {
  console.error("✖ Falta SUPABASE_SERVICE_ROLE_KEY (para escribir). Probá con --dry-run.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY ?? "dry", { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ejes de búsqueda alineados a las PLANTILLAS de solución activas (Paso 1).
// Cada rubro mapea a la plantilla que lo trabaja. (Salud fuera de foco.)
const RUBROS = [
  { key: "distribucion", rubro: "Distribución", query: "distribuidora mayorista", plantilla: "pedidos" },
  { key: "importadora", rubro: "Importadora", query: "importadora", plantilla: "pedidos" },
  { key: "logistica", rubro: "Logística", query: "empresa de logística y carga", plantilla: "rentabilidad_logistica" },
  { key: "contable", rubro: "Contable", query: "firma de contadores públicos", plantilla: "backoffice_contable" },
];

const ZONAS = [
  // Perfil A — alta rotación / margen ajustado
  { nombre: "Juan Díaz", perfil: "A" },
  { nombre: "Transístmica", perfil: "A" },
  { nombre: "Bethania", perfil: "A" },
  { nombre: "Las Mañanitas", perfil: "A" },
  { nombre: "Tocumen", perfil: "A" },
  { nombre: "Ojo de Agua", perfil: "A" },
  { nombre: "Calidonia", perfil: "A" },
  // Perfil B — ticket alto / volumen controlado
  { nombre: "Costa del Este", perfil: "B" },
  { nombre: "Obarrio", perfil: "B" },
  { nombre: "San Francisco", perfil: "B" },
  { nombre: "Marbella", perfil: "B" },
  { nombre: "Punta Pacífica", perfil: "B" },
  { nombre: "El Dorado", perfil: "B" },
  { nombre: "Paitilla", perfil: "B" },
];

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.businessStatus",
  "places.userRatingCount",
  "places.rating",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.location",
  "places.primaryTypeDisplayName",
  "nextPageToken",
].join(",");

async function buscarPagina(textQuery, pageToken) {
  const body = { textQuery, languageCode: "es", regionCode: "PA", pageSize: 20 };
  if (pageToken) body.pageToken = pageToken;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": MAPS_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Places API: ${data.error.message}`);
  return { places: data.places ?? [], nextPageToken: data.nextPageToken ?? null };
}

function estadoDesdeBusinessStatus(bs) {
  if (bs === "CLOSED_PERMANENTLY") return { e: "cerrado", m: "Google Maps lo marca como CERRADO PERMANENTEMENTE." };
  if (bs === "CLOSED_TEMPORARILY") return { e: "dudoso", m: "Cierre TEMPORAL en Maps — verificar antes de contactar." };
  if (bs === "OPERATIONAL") return { e: "operativo", m: "Operativo en Maps (recién descubierto)." };
  return { e: "sin_validar", m: "Sin business_status (recién descubierto)." };
}

function aLead(p, rubroObj, zona) {
  const { e, m } = estadoDesdeBusinessStatus(p.businessStatus);
  const tel = p.nationalPhoneNumber || p.internationalPhoneNumber || null;
  const web = p.websiteUri || null;
  const dir = p.formattedAddress || null;
  return {
    nombre: p.displayName?.text ?? "(sin nombre)",
    rubro: rubroObj.rubro,
    plantilla: rubroObj.plantilla,
    zona: zona.nombre,
    fuente: "Google Places (discovery)",
    web,
    telefono: tel,
    direccion: dir,
    rating: p.rating ?? null,
    latitud: p.location?.latitude ?? null,
    longitud: p.location?.longitude ?? null,
    place_id: p.id,
    business_status: p.businessStatus ?? null,
    user_ratings_total: p.userRatingCount ?? null,
    validacion_estado: e,
    validacion_motivo: m,
    validado_at: new Date().toISOString(),
    estado: "nuevo",
    // los datos de contacto vienen de Maps → son la fuente de verdad
    maps_telefono: tel,
    maps_web: web,
    maps_direccion: dir,
  };
}

async function main() {
  const rubros = SOLO_RUBRO ? RUBROS.filter((r) => r.key === SOLO_RUBRO) : RUBROS;
  const zonas = SOLO_ZONA ? ZONAS.filter((z) => z.nombre.toLowerCase() === SOLO_ZONA.toLowerCase()) : ZONAS;
  if (!rubros.length || !zonas.length) {
    console.error("✖ Rubro o zona no reconocidos. Rubros: " + RUBROS.map((r) => r.key).join(", "));
    process.exit(1);
  }

  console.log(
    `\n🔎 Buscador de prospectos — ${DRY_RUN ? "DRY-RUN (no escribe)" : "ESCRIBIENDO en Supabase"}\n` +
      `   ${rubros.length} rubro(s) × ${zonas.length} zona(s) × ${PAGES} pág = hasta ${rubros.length * zonas.length * PAGES * 20} resultados\n`
  );

  // place_ids que ya tenés → para no duplicar
  const yaExisten = new Set();
  {
    const { data, error } = await supabase.from("leads").select("place_id").not("place_id", "is", null);
    if (error) { console.error("✖ No pude leer place_ids existentes:", error.message); process.exit(1); }
    for (const row of data) yaExisten.add(row.place_id);
  }
  console.log(`   (${yaExisten.size} place_ids ya en tu base — se saltean)\n`);

  const vistosEnEstaCorrida = new Set();
  const nuevos = [];
  const resumen = { encontrados: 0, nuevos: 0, duplicados: 0, descartCerrado: 0, descartSinContacto: 0 };

  for (const r of rubros) {
    for (const z of zonas) {
      const query = `${r.query} en ${z.nombre}, Ciudad de Panamá, Panamá`;
      let token = null;
      let porCombo = 0;
      try {
        for (let page = 0; page < PAGES; page++) {
          const { places, nextPageToken } = await buscarPagina(query, token);
          for (const p of places) {
            if (!p.id) continue;
            resumen.encontrados++;
            if (yaExisten.has(p.id) || vistosEnEstaCorrida.has(p.id)) { resumen.duplicados++; continue; }
            vistosEnEstaCorrida.add(p.id);
            // --- FILTRO DURO (tu criterio: operativo + contactable) ---
            if (p.businessStatus === "CLOSED_PERMANENTLY") { resumen.descartCerrado++; continue; }
            const tel = p.nationalPhoneNumber || p.internationalPhoneNumber || null;
            const web = p.websiteUri || null;
            if (!tel && !web) { resumen.descartSinContacto++; continue; }
            // pasa → prospecto calificado
            nuevos.push(aLead(p, r, z));
            porCombo++;
          }
          token = nextPageToken;
          if (!token) break;
          await sleep(2100); // el pageToken tarda ~2s en activarse
        }
      } catch (e) {
        console.error(`   ⚠ ${r.rubro} / ${z.nombre}: ${e.message}`);
      }
      console.log(`   ${r.rubro.padEnd(12)} / ${z.nombre.padEnd(16)} → ${porCombo} nuevos`);
      await sleep(200);
    }
  }

  resumen.nuevos = nuevos.length;

  // escribir
  if (!DRY_RUN && nuevos.length) {
    for (let i = 0; i < nuevos.length; i += 100) {
      const lote = nuevos.slice(i, i + 100);
      const { error } = await supabase.from("leads").insert(lote);
      if (error) console.error(`   ✖ error insertando lote: ${error.message}`);
    }
  }

  console.log(
    `\n── Resumen ──\n` +
      `   Resultados vistos:          ${resumen.encontrados}\n` +
      `   Ya existían (skip):         ${resumen.duplicados}\n` +
      `   Descartados — cerrados:     ${resumen.descartCerrado}\n` +
      `   Descartados — sin contacto: ${resumen.descartSinContacto}\n` +
      `   🆕 Nuevos (calificados):    ${resumen.nuevos}\n` +
      (DRY_RUN ? "\n(DRY-RUN: no se escribió nada)\n" : "\n(Nuevos prospectos insertados en `leads`, estado='nuevo', sin scoring aún)\n")
  );

  // muestra de lo encontrado
  if (nuevos.length) {
    console.log("Muestra de prospectos nuevos:");
    for (const l of nuevos.slice(0, 12)) {
      console.log(`   • ${l.nombre}  [${l.rubro} / ${l.zona}]  ${l.rating ?? "s/r"}★  →plantilla:${l.plantilla}`);
    }
  }
}

main().catch((e) => { console.error("✖ Error fatal:", e); process.exit(1); });
