/**
 * Enriquecedor multi-fuente (Paso 3) — Codflow
 * --------------------------------------------------------------
 * Por cada lead reúne SEÑALES de información de varias fuentes y las guarda en `senales`.
 * Modelo source-agnostic (idea del equipo): cada señal = {tipo, dato, fuente, fecha, confianza}.
 * v1: reseñas de Google (Places API) + sitio web propio (fetch + extracción de texto).
 *     Los sitios renderizados en JS (SPA) se detectan y se marcan para navegador headless.
 *
 * USO:
 *   node scripts/enriquecer.mjs --dry-run --limit 3
 *   node scripts/enriquecer.mjs --plantilla pedidos --limit 20
 *   node scripts/enriquecer.mjs --solo-sin-senales      # solo los que aún no tienen señales
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
    } catch {}
  }
}
loadEnv();

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SOLO_SIN = args.includes("--solo-sin-senales");
const SOLO_WEB = args.includes("--solo-web"); // re-extrae web sin re-pagar reseñas
const arg = (n) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : null; };
const SOLO_PLANTILLA = arg("--plantilla");
const SOLO_PRE_TIER = arg("--pre-tier");
const LIMIT = arg("--limit") ? parseInt(arg("--limit"), 10) : null;

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!MAPS_KEY || !SUPABASE_URL) { console.error("✖ Falta GOOGLE_MAPS_API_KEY o NEXT_PUBLIC_SUPABASE_URL"); process.exit(1); }
if (!SERVICE_KEY && !DRY_RUN) { console.error("✖ Falta SUPABASE_SERVICE_ROLE_KEY (probá --dry-run)"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY ?? "dry", { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// señales que buscamos en el HTML/texto del sitio (relevantes a las plantillas)
const KEYWORDS = [
  { re: /whatsapp|wa\.me|api\.whatsapp/i, label: "Usa WhatsApp como canal" },
  { re: /instagram\.com/i, label: "Enlaza Instagram" },
  { re: /facebook\.com/i, label: "Enlaza Facebook" },
  { re: /carrito|checkout|tienda en l[íi]nea|tienda online|comprar en l[íi]nea|e-?commerce|woocommerce|shopify/i, label: "Tiene tienda online / e-commerce" },
  { re: /cat[áa]logo/i, label: "Tiene catálogo publicado" },
  { re: /rastreo|tracking|seguimiento de env[íi]o/i, label: "Ofrece rastreo / tracking" },
  { re: /cotiza|cotizaci[óo]n/i, label: "Maneja cotizaciones" },
  { re: /itbms|sipe|niif|declaraci[óo]n jurada|conciliaci/i, label: "Trabajo contable/fiscal declarado" },
  { re: /a[ñn]os de experiencia|desde 19\d\d|desde 20[01]\d|fundad[ao]/i, label: "Antigüedad/experiencia declarada" },
];

function htmlATexto(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normUrl(u) { return /^https?:\/\//i.test(u) ? u : `https://${u}`; }

// meta description / og:description (orden de atributos flexible)
function metaContent(html, key) {
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metas) {
    const m = tag.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i);
    if (m && m[1].toLowerCase() === key) {
      const c = tag.match(/content\s*=\s*["']([^"']*)["']/i);
      if (c && c[1].trim()) return c[1].trim();
    }
  }
  return null;
}

// encabezados H1-H3 (lo más descriptivo del sitio), deduplicados
function extraerHeadings(html) {
  const hs = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((m) => htmlATexto(m[1]))
    .filter((t) => t.length >= 4 && t.length <= 80);
  const vistos = new Set();
  const out = [];
  for (const h of hs) {
    const k = h.toLowerCase();
    if (!vistos.has(k)) { vistos.add(k); out.push(h); }
  }
  return out.slice(0, 8);
}

async function traerResenas(placeId) {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": MAPS_KEY,
      "X-Goog-FieldMask": "reviews.text,reviews.rating,reviews.publishTime,reviews.relativePublishTimeDescription",
    },
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.reviews ?? []).map((r) => ({
    tipo: "resena",
    dato: `${r.rating ?? "?"}★ (${r.relativePublishTimeDescription ?? ""}) ${((r.text || {}).text || "").slice(0, 600)}`.trim(),
    fuente: "google_reviews",
    fecha: r.publishTime ?? null,
    confianza: "alta",
  }));
}

async function traerWeb(url) {
  const senales = [];
  let html = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(normUrl(url), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CodflowBot/1.0)" },
    });
    clearTimeout(t);
    if (!res.ok) {
      senales.push({ tipo: "web_diag", dato: `Sitio no accesible (HTTP ${res.status})`, fuente: "website", fecha: null, confianza: "baja" });
      return senales;
    }
    html = await res.text();
  } catch (e) {
    senales.push({ tipo: "web_diag", dato: `Sitio no accesible (${e.name === "AbortError" ? "timeout" : e.message})`, fuente: "website", fecha: null, confianza: "baja" });
    return senales;
  }

  const texto = htmlATexto(html);
  // resumen LIMPIO: título + meta-descripción + encabezados (no el menú crudo)
  const title = htmlATexto((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const desc = metaContent(html, "description") || metaContent(html, "og:description");
  const headings = extraerHeadings(html);
  const partes = [];
  if (title) partes.push(title);
  if (desc) partes.push(htmlATexto(desc));
  if (headings.length) partes.push("Secciones: " + headings.join(" · "));
  let resumen = partes.join(" — ");
  if (!resumen && texto.length >= 300) resumen = texto.slice(0, 500); // fallback mínimo

  if (resumen) {
    senales.push({ tipo: "web_resumen", dato: resumen.slice(0, 1000), fuente: "website", fecha: null, confianza: "media" });
  } else {
    senales.push({ tipo: "web_diag", dato: "Sitio con poco contenido legible (posible SPA/JS) — requiere navegador headless", fuente: "website", fecha: null, confianza: "baja" });
  }
  for (const k of KEYWORDS) {
    if (k.re.test(html)) senales.push({ tipo: "web_senal", dato: k.label, fuente: "website", fecha: null, confianza: "media" });
  }
  return senales;
}

async function main() {
  console.log(`\n🧩 Enriquecedor (Paso 3) — ${DRY_RUN ? "DRY-RUN (no escribe)" : "ESCRIBIENDO señales"}` +
    `${SOLO_PLANTILLA ? ` | plantilla=${SOLO_PLANTILLA}` : ""}${SOLO_SIN ? " | solo sin señales" : ""}${LIMIT ? ` | limit ${LIMIT}` : ""}\n`);

  let q = supabase.from("leads").select("id, nombre, place_id, web, maps_web, plantilla")
    .not("plantilla", "is", null) // solo leads en foco (con plantilla)
    .order("puntaje_total", { ascending: false, nullsFirst: false });
  if (SOLO_PLANTILLA) q = q.eq("plantilla", SOLO_PLANTILLA);
  if (SOLO_PRE_TIER) q = q.eq("pre_tier", SOLO_PRE_TIER);
  if (LIMIT) q = q.limit(LIMIT);
  const { data: leads, error } = await q;
  if (error) { console.error("✖ Error leyendo leads:", error.message); process.exit(1); }

  let objetivo = leads;
  if (SOLO_SIN) {
    const { data: conSenales } = await supabase.from("senales").select("lead_id");
    const ya = new Set((conSenales ?? []).map((r) => r.lead_id));
    objetivo = leads.filter((l) => !ya.has(l.id));
  }
  if (!objetivo.length) { console.log("Nada para enriquecer."); return; }

  const resumen = { leads: 0, senales: 0, resenas: 0, web_ok: 0, web_spa: 0 };

  for (const lead of objetivo) {
    const senales = [];
    if (!SOLO_WEB) {
      try {
        if (lead.place_id) {
          const r = await traerResenas(lead.place_id);
          senales.push(...r);
          resumen.resenas += r.length;
          await sleep(120);
        }
      } catch (e) { console.error(`   ⚠ ${lead.nombre} reseñas: ${e.message}`); }
    }

    const url = lead.web || lead.maps_web;
    if (url) {
      const w = await traerWeb(url);
      senales.push(...w);
      if (w.some((s) => s.tipo === "web_diag")) resumen.web_spa++; else resumen.web_ok++;
    }

    resumen.leads++;
    resumen.senales += senales.length;
    const resenas = senales.filter((s) => s.tipo === "resena").length;
    const websen = senales.filter((s) => s.tipo === "web_senal").map((s) => s.dato);
    console.log(`   • ${lead.nombre}  →  ${senales.length} señales (${resenas} reseñas${websen.length ? ", web: " + websen.join(", ") : ""})`);

    if (!DRY_RUN && senales.length) {
      // idempotente: en --solo-web solo reemplaza las señales web (preserva reseñas)
      let del = supabase.from("senales").delete().eq("lead_id", lead.id);
      if (SOLO_WEB) del = del.like("tipo", "web%");
      await del;
      const filas = senales.map((s) => ({ ...s, lead_id: lead.id }));
      const { error: upErr } = await supabase.from("senales").insert(filas);
      if (upErr) console.error(`     ✖ no se pudo guardar: ${upErr.message}`);
    }
    await sleep(150);
  }

  console.log(`\n── Resumen ──\n` +
    `   Leads enriquecidos:  ${resumen.leads}\n` +
    `   Señales creadas:     ${resumen.senales}\n` +
    `      ├ reseñas:        ${resumen.resenas}\n` +
    `      ├ webs leídas:    ${resumen.web_ok}\n` +
    `      └ webs SPA/caídas: ${resumen.web_spa}\n` +
    (DRY_RUN ? "\n(DRY-RUN: no se escribió nada)\n" : "\n(Señales guardadas en la tabla `senales`)\n"));
}

main().catch((e) => { console.error("✖ Error fatal:", e); process.exit(1); });
