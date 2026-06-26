/**
 * Validador de Operatividad de Leads — Codflow
 * ------------------------------------------------------------
 * Filtra la "basura de entrada" de Google Maps ANTES de que un comercial
 * pierda tiempo: detecta negocios cerrados, datos sucios y dudosos.
 *
 * Capa 1 (determinística, sin IA): usa la señal estrella de Places API
 *   `business_status` (OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY)
 *   + nº de reseñas + web/teléfono vivos para emitir un veredicto.
 *
 * Escribe en la tabla `leads` de Supabase:
 *   place_id, business_status, user_ratings_total,
 *   validacion_estado (operativo | dudoso | cerrado | no_encontrado),
 *   validacion_motivo, validado_at
 *
 * USO:
 *   node scripts/validar-operatividad.mjs            # valida los 'sin_validar' y escribe
 *   node scripts/validar-operatividad.mjs --dry-run  # no escribe, solo reporta
 *   node scripts/validar-operatividad.mjs --all      # revalida TODOS los leads
 *   node scripts/validar-operatividad.mjs --limit 5  # solo los primeros N
 *
 * REQUIERE (en .env.local, junto a la raíz del proyecto):
 *   GOOGLE_MAPS_API_KEY=...            (Places API habilitada en Google Cloud)
 *   NEXT_PUBLIC_SUPABASE_URL=...       (ya lo tenés)
 *   SUPABASE_SERVICE_ROLE_KEY=...      (Supabase → Settings → API → service_role)
 *                                       Se usa solo del lado servidor para poder
 *                                       ESCRIBIR (la anon key solo puede leer por RLS).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ---------- carga de .env.local (loader mínimo, sin dependencias) ----------
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
      /* el archivo puede no existir; las vars pueden venir del entorno */
    }
  }
}
loadEnv();

// ---------- flags de línea de comandos ----------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REVALIDATE_ALL = args.includes("--all");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : null;
})();

// ---------- config / chequeos ----------
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MAPS_KEY) {
  console.error("✖ Falta GOOGLE_MAPS_API_KEY en .env.local");
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.error("✖ Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
  process.exit(1);
}
if (!SERVICE_KEY && !DRY_RUN) {
  console.error(
    "✖ Falta SUPABASE_SERVICE_ROLE_KEY en .env.local (necesaria para escribir).\n" +
      "  Probá con --dry-run para correr sin escribir, o agregá la service_role key."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY ?? "dummy-for-dry-run", {
  auth: { persistSession: false },
});

// ---------- parámetros del filtro (ajustables) ----------
const RESENAS_MIN_CONFIABLE = 5; // < esto => rating poco confiable (caso "SIEMA 1.0")
const MESES_RESENA_VIEJA = 24; // sin reseñas en > N meses => señal de inactividad
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- llamada a Places API (New) — un solo Text Search trae todo ----------
async function buscarLugar(query) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": MAPS_KEY,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.businessStatus",
        "places.userRatingCount",
        "places.rating",
        "places.websiteUri",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.reviews",
      ].join(","),
    },
    body: JSON.stringify({ textQuery: query, languageCode: "es", regionCode: "PA", maxResultCount: 1 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Places API rechazó la petición: ${data.error.message}`);
  const p = data.places?.[0];
  if (!p) return null;
  // Normalizamos a un shape estable para el resto del script
  return {
    place_id: p.id ?? null,
    business_status: p.businessStatus ?? null,
    user_ratings_total: p.userRatingCount ?? null,
    rating: p.rating ?? null,
    website: p.websiteUri ?? null,
    formatted_phone_number: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    formatted_address: p.formattedAddress ?? null,
    reviews: p.reviews ?? null,
  };
}

// ---------- reconciliación de campos contra Maps (fuente de verdad) ----------
const soloDigitos = (s) => (s ?? "").replace(/\D/g, "");
function normTel(s) {
  let d = soloDigitos(s);
  if (d.startsWith("507")) d = d.slice(3); // quitamos código de país Panamá
  return d;
}
function normWeb(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/\/$/, "");
}

/**
 * Compara los campos guardados del lead contra los de Maps.
 * - Falta el dato y Maps lo tiene  → lo completamos (enriquecer).
 * - Difiere                        → lo marcamos (NO pisamos; decide un humano).
 */
function reconciliar(lead, lugar) {
  const updates = {};
  const disc = [];
  const enriquecidos = [];
  const mapsTel = lugar.formatted_phone_number || null;
  const mapsWeb = lugar.website || null;
  const mapsDir = lugar.formatted_address || null;

  if (mapsTel) {
    if (!lead.telefono) {
      updates.telefono = mapsTel;
      enriquecidos.push("teléfono");
    } else if (normTel(lead.telefono) && normTel(mapsTel) && normTel(lead.telefono) !== normTel(mapsTel)) {
      disc.push(`teléfono difiere (guardado ${lead.telefono} / Maps ${mapsTel})`);
    }
  }
  if (mapsWeb) {
    if (!lead.web) {
      updates.web = mapsWeb;
      enriquecidos.push("web");
    } else if (normWeb(lead.web) && normWeb(mapsWeb) && normWeb(lead.web) !== normWeb(mapsWeb)) {
      disc.push(`web difiere (guardada ${lead.web} / Maps ${mapsWeb})`);
    }
  }

  return {
    updates, // campos del lead a completar (solo si faltaban)
    maps_telefono: mapsTel,
    maps_web: mapsWeb,
    maps_direccion: mapsDir,
    discrepancias: disc.length ? disc.join("; ") : null,
    enriquecidos,
  };
}

// ¿el sitio web responde? (timeout corto; muchos sitios bloquean HEAD => usamos GET)
async function webViva(website) {
  if (!website) return null; // sin web => no aplica
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(website, { method: "GET", signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    return res.status < 400;
  } catch {
    return false; // dominio caído / DNS / timeout
  }
}

function mesesDesdeUltimaResena(reviews) {
  if (!reviews?.length) return null;
  // Places API (New): cada review trae publishTime en RFC3339 (ISO)
  const tiempos = reviews.map((r) => (r.publishTime ? Date.parse(r.publishTime) : 0)).filter(Boolean);
  if (!tiempos.length) return null;
  const masReciente = Math.max(...tiempos); // ms
  return (Date.now() - masReciente) / (1000 * 60 * 60 * 24 * 30.44);
}

// ---------- el corazón: reglas del filtro duro ----------
function dictaminar({ details, webOk, mesesResena }) {
  const bs = details?.business_status ?? null;
  const reseñas = details?.user_ratings_total ?? 0;
  const notas = [];

  // 1) Cerrado permanente => fuera
  if (bs === "CLOSED_PERMANENTLY") {
    return { estado: "cerrado", motivo: "Google Maps lo marca como CERRADO PERMANENTEMENTE." };
  }
  // 2) Cierre temporal => revisar (no descartar: remodelación, vacaciones)
  if (bs === "CLOSED_TEMPORARILY") {
    return {
      estado: "dudoso",
      motivo: "Cierre TEMPORAL en Maps — verificar antes de contactar (puede ser remodelación/vacaciones).",
    };
  }

  // 3) Señales de duda aunque figure OPERATIONAL
  const señalesDuda = [];
  if (webOk === false) señalesDuda.push("sitio web caído");
  if (mesesResena !== null && mesesResena > MESES_RESENA_VIEJA)
    señalesDuda.push(`sin reseñas desde hace ${Math.round(mesesResena)} meses`);
  if (!details?.formatted_phone_number) señalesDuda.push("sin teléfono");

  if (reseñas < RESENAS_MIN_CONFIABLE) {
    notas.push(`rating poco confiable (${reseñas} reseña/s)`);
  }

  // 2+ señales de duda => marcar para revisión humana
  if (señalesDuda.length >= 2) {
    return {
      estado: "dudoso",
      motivo: `Figura operativo pero: ${señalesDuda.join(" + ")}. ${notas.join("; ")}`.trim(),
    };
  }

  // 4) Operativo
  const motivo = bs === "OPERATIONAL"
    ? `Operativo en Maps${notas.length ? " (" + notas.join("; ") + ")" : ""}.`
    : `Sin business_status explícito${notas.length ? " (" + notas.join("; ") + ")" : ""}.`;
  return { estado: "operativo", motivo };
}

// ---------- main ----------
async function main() {
  console.log(
    `\n🔎 Validador de operatividad — ${DRY_RUN ? "DRY-RUN (no escribe)" : "ESCRIBIENDO en Supabase"}` +
      `${REVALIDATE_ALL ? " | revalidando TODOS" : " | solo sin_validar"}${LIMIT ? ` | limit ${LIMIT}` : ""}\n`
  );

  let q = supabase
    .from("leads")
    .select("id, nombre, direccion, web, telefono, rating, validacion_estado")
    .order("puntaje_total", { ascending: false, nullsFirst: false });
  if (!REVALIDATE_ALL) q = q.or("validacion_estado.is.null,validacion_estado.eq.sin_validar");
  if (LIMIT) q = q.limit(LIMIT);

  const { data: leads, error } = await q;
  if (error) {
    console.error("✖ Error leyendo leads:", error.message);
    process.exit(1);
  }
  if (!leads.length) {
    console.log("Nada para validar. (Usá --all para revalidar todo.)");
    return;
  }

  const resumen = { operativo: 0, dudoso: 0, cerrado: 0, no_encontrado: 0, enriquecidos: 0, discrepancias: 0 };

  for (const lead of leads) {
    const query = [lead.nombre, lead.direccion, "Panamá"].filter(Boolean).join(", ");
    let update;

    try {
      const lugar = await buscarLugar(query);
      if (!lugar?.place_id) {
        update = {
          place_id: null,
          business_status: null,
          user_ratings_total: null,
          validacion_estado: "no_encontrado",
          validacion_motivo: "No se encontró el negocio en Google Maps con nombre+dirección. Revisar datos.",
        };
      } else {
        const webOk = await webViva(lugar.website ?? lead.web);
        const mesesResena = mesesDesdeUltimaResena(lugar.reviews);
        const { estado, motivo } = dictaminar({ details: lugar, webOk, mesesResena });
        const recon = reconciliar(lead, lugar);
        update = {
          place_id: lugar.place_id,
          business_status: lugar.business_status,
          user_ratings_total: lugar.user_ratings_total,
          validacion_estado: estado,
          validacion_motivo: motivo,
          // reconciliación de campos
          ...recon.updates, // completa telefono/web si faltaban
          maps_telefono: recon.maps_telefono,
          maps_web: recon.maps_web,
          maps_direccion: recon.maps_direccion,
          discrepancias: recon.discrepancias,
        };
        update._enriquecidos = recon.enriquecidos; // solo para el reporte (no se guarda)
        update._discrepancias = recon.discrepancias;
      }
    } catch (e) {
      console.error(`  ⚠ ${lead.nombre}: ${e.message}`);
      continue; // no escribimos si la API falló; se reintenta en la próxima corrida
    }

    // separamos los campos auxiliares (solo reporte) de lo que va a la tabla
    const { _enriquecidos = [], _discrepancias = null, ...dbUpdate } = update;

    resumen[dbUpdate.validacion_estado] = (resumen[dbUpdate.validacion_estado] ?? 0) + 1;
    const icono = { operativo: "✅", dudoso: "🟡", cerrado: "⛔", no_encontrado: "❓" }[dbUpdate.validacion_estado];
    console.log(`  ${icono} ${lead.nombre}\n     → ${dbUpdate.validacion_motivo}`);
    if (_enriquecidos.length) {
      resumen.enriquecidos += _enriquecidos.length;
      console.log(`     ＋ completado desde Maps: ${_enriquecidos.join(", ")}`);
    }
    if (_discrepancias) {
      resumen.discrepancias += 1;
      console.log(`     ⚠ datos: ${_discrepancias}`);
    }

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from("leads")
        .update({ ...dbUpdate, validado_at: new Date().toISOString() })
        .eq("id", lead.id);
      if (upErr) console.error(`     ✖ no se pudo guardar: ${upErr.message}`);
    }

    await sleep(150); // respetar QPS de Places API
  }

  console.log(
    `\n── Resumen ──\n` +
      `  ✅ operativos:     ${resumen.operativo ?? 0}\n` +
      `  🟡 dudosos:        ${resumen.dudoso ?? 0}\n` +
      `  ⛔ cerrados:       ${resumen.cerrado ?? 0}\n` +
      `  ❓ no encontrados: ${resumen.no_encontrado ?? 0}\n` +
      `  ━━━━━━━━━━━━━━━\n` +
      `  ＋ campos completados desde Maps: ${resumen.enriquecidos}\n` +
      `  ⚠ leads con datos en discrepancia: ${resumen.discrepancias}\n` +
      `  Total procesados:  ${leads.length}\n` +
      (DRY_RUN ? "\n(DRY-RUN: no se escribió nada en Supabase)\n" : "\n(Resultados guardados en la tabla leads)\n")
  );
}

main().catch((e) => {
  console.error("✖ Error fatal:", e);
  process.exit(1);
});
