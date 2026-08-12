import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Lead } from "@/types/lead";

// Valores públicos del proyecto Supabase de Codflow (la anon key ya viaja en el bundle
// del navegador por ser NEXT_PUBLIC). La variable de entorno tiene prioridad si está definida;
// el fallback garantiza que el deploy funcione sin depender de la config de Vercel.
const FALLBACK_SUPABASE_URL = "https://oidamsohoevhiyhqlegt.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZGFtc29ob2V2aGl5aHFsZWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjI4NTUsImV4cCI6MjEwMTkzODg1NX0.1PYz2DpqVy7Gcr4GK3mT6nbNTrbbHe3ewPK5XHPCKic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// No tiramos en tiempo de carga: si faltan las claves, el cliente queda en null
// y la app degrada a lista vacía en vez de crashear (build/deploy siguen funcionando).
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export async function fetchLeads(): Promise<Lead[]> {
  if (!supabase) {
    console.warn(
      "Supabase no configurado: faltan NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY. Devolviendo lista vacía."
    );
    return [];
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .not("plantilla", "is", null) // solo prospectos en foco (excluye salud / fuera de foco)
    .order("puntaje_total", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Error al leer leads de Supabase: ${error.message}`);
  }

  return (data ?? []) as Lead[];
}
