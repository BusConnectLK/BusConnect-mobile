import { supabase } from "./supabase";

export interface PopularRoute {
  originId: string;
  destId: string;
  originName: string;
  destName: string;
  durationMinutes: number | null;
  /** Total upcoming trips (any day) — used for popularity ranking. */
  tripCount: number;
  /** Trips departing today (Asia/Colombo calendar day) — what the card's "Today" badge shows. */
  todayCount: number;
  /** Calendar date (Asia/Colombo, yyyy-mm-dd) of the soonest upcoming trip, if any. */
  nextDateIso: string | null;
  imageUrl: string | null;
  minFare: number | null;
}

interface RouteRow {
  origin_id: string;
  dest_id: string;
  image_url: string | null;
  origin: { name_en: string } | null;
  dest: { name_en: string } | null;
}

interface TripRow {
  depart_at: string;
  arrive_est: string | null;
  base_fare: number;
  route: { origin_id: string; dest_id: string } | null;
}

type PairAgg = {
  originId: string;
  destId: string;
  originName: string;
  destName: string;
  durations: number[];
  fares: number[];
  count: number;
  todayCount: number;
  nextDateIso: string | null;
  imageUrl: string | null;
};

/** Calendar date (Asia/Colombo) a timestamp falls on, as yyyy-mm-dd. */
function colomboDateIso(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
}

/**
 * Same aggregation as BusConnect-web's lib/popular-routes.ts, adapted to a
 * plain client-side Supabase read (no Next.js unstable_cache here) — every
 * published route is guaranteed to appear, ranked above ones without real
 * upcoming trips by how many trips actually exist for that corridor.
 */
export async function listPopularRoutes(limit?: number): Promise<PopularRoute[]> {
  const byPair = new Map<string, PairAgg>();

  const [{ data: routes, error: routesErr }, { data: trips, error: tripsErr }] = await Promise.all([
    supabase
      .from("routes")
      .select(
        `origin_id, dest_id, image_url,
         origin:locations!routes_origin_id_fkey ( name_en ),
         dest:locations!routes_dest_id_fkey ( name_en )`,
      ),
    supabase
      .from("trips")
      .select(
        `depart_at, arrive_est, base_fare,
         route:routes!inner ( origin_id, dest_id ),
         bus:buses!inner ( operator:operators!inner ( status ) )`,
      )
      .eq("bus.operator.status", "active")
      .gte("depart_at", new Date().toISOString())
      .in("status", ["scheduled", "boarding"])
      .limit(500),
  ]);
  if (routesErr) console.error("listPopularRoutes: could not load the route catalog —", routesErr.message);
  if (tripsErr) console.error("listPopularRoutes: could not load trip activity —", tripsErr.message);

  for (const r of (routes ?? []) as unknown as RouteRow[]) {
    const key = `${r.origin_id}|${r.dest_id}`;
    const existing = byPair.get(key);
    if (existing) {
      if (!existing.imageUrl && r.image_url) existing.imageUrl = r.image_url;
    } else {
      byPair.set(key, {
        originId: r.origin_id,
        destId: r.dest_id,
        originName: r.origin?.name_en ?? "Unknown",
        destName: r.dest?.name_en ?? "Unknown",
        durations: [],
        fares: [],
        count: 0,
        todayCount: 0,
        nextDateIso: null,
        imageUrl: r.image_url,
      });
    }
  }

  const today = colomboDateIso(new Date().toISOString());

  for (const row of (trips ?? []) as unknown as TripRow[]) {
    const route = row.route;
    if (!route) continue;
    const key = `${route.origin_id}|${route.dest_id}`;
    const duration = row.arrive_est
      ? Math.round((new Date(row.arrive_est).getTime() - new Date(row.depart_at).getTime()) / 60000)
      : null;

    const existing = byPair.get(key) ?? {
      originId: route.origin_id,
      destId: route.dest_id,
      originName: "Unknown",
      destName: "Unknown",
      durations: [],
      fares: [],
      count: 0,
      todayCount: 0,
      nextDateIso: null,
      imageUrl: null,
    };
    existing.count += 1;
    if (duration != null) existing.durations.push(duration);
    if (row.base_fare != null) existing.fares.push(Number(row.base_fare));

    const tripDate = colomboDateIso(row.depart_at);
    if (tripDate === today) existing.todayCount += 1;
    if (!existing.nextDateIso || tripDate < existing.nextDateIso) existing.nextDateIso = tripDate;

    byPair.set(key, existing);
  }

  const sorted = [...byPair.values()].sort(
    (a, b) => b.count - a.count || a.originName.localeCompare(b.originName),
  );
  const mapped = sorted.map((r) => ({
    originId: r.originId,
    destId: r.destId,
    originName: r.originName,
    destName: r.destName,
    durationMinutes: r.durations.length > 0 ? Math.min(...r.durations) : null,
    tripCount: r.count,
    todayCount: r.todayCount,
    nextDateIso: r.nextDateIso,
    imageUrl: r.imageUrl,
    minFare: r.fares.length > 0 ? Math.min(...r.fares) : null,
  }));
  return limit != null ? mapped.slice(0, limit) : mapped;
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
