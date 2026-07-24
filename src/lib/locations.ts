import { supabase } from "./supabase";

export interface Location {
  id: string;
  name_en: string;
  name_si: string | null;
  name_ta: string | null;
}

/** Public read under RLS (see BusConnect-api/supabase/migrations/0003_rls.sql) —
 * same direct-Supabase-read pattern as BusConnect-web's lib/locations.ts. */
export async function listLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name_en, name_si, name_ta")
    .order("name_en");

  if (error) {
    console.error("listLocations:", error.message);
    return [];
  }
  return data ?? [];
}
