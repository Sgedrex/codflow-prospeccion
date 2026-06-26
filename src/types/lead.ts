export type Tier = "alto" | "medio" | "bajo";

export interface Lead {
  id: string;
  nombre: string;
  rubro: string | null;
  fuente: string | null;
  web: string | null;
  telefono: string | null;
  direccion: string | null;
  rating: number | null;
  latitud: number | null;
  longitud: number | null;
  senal_destacada: string | null;
  punt_necesidad: number | null;
  punt_capacidad: number | null;
  punt_competencia: number | null;
  punt_madurez: number | null;
  punt_fit_datos: number | null;
  puntaje_total: number | null;
  tier: string | null;
  razon: string | null;
  angulo_contacto: string | null;
  estado: string | null;
  // --- validación de operatividad (escrito por scripts/validar-operatividad.mjs) ---
  place_id: string | null;
  business_status: string | null;
  user_ratings_total: number | null;
  validacion_estado: string | null;
  validacion_motivo: string | null;
  validado_at: string | null;
  // --- reconciliación de campos contra Maps (fuente de verdad) ---
  maps_telefono: string | null;
  maps_web: string | null;
  maps_direccion: string | null;
  discrepancias: string | null;
  // --- prospección: plantilla de solución + pre-calificación ---
  zona: string | null;
  plantilla: string | null;
  pre_score: number | null;
  pre_tier: string | null;
  pre_motivo: string | null;
  // --- Compuerta 2: calificación de viabilidad sobre señales ---
  viabilidad_score: number | null;
  calificacion_final: string | null;
  calificacion_motivo: string | null;
  calificado_at: string | null;
  created_at: string;
}

export const PLANTILLA_LABEL: Record<string, string> = {
  pedidos: "Pedidos",
  rentabilidad_logistica: "Logística",
  backoffice_contable: "Contable",
};

export const VIABILIDAD_LABEL: Record<string, string> = {
  alto: "Alta",
  medio: "Media",
  bajo: "Baja",
  revisar_manual: "Revisar manual",
  sin_enriquecer: "Sin enriquecer",
};

export const VIABILIDAD_ORDER = ["alto", "medio", "bajo", "revisar_manual", "sin_enriquecer"];

export type ValidacionEstado =
  | "operativo"
  | "dudoso"
  | "cerrado"
  | "no_encontrado"
  | "sin_validar";
