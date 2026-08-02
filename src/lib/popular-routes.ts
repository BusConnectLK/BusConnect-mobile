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

/** One row of popular_route_activity() — see BusConnect-api's 0043_popular_route_activity.sql. */
interface ActivityRow {
  origin_id: string;
  dest_id: string;
  trip_count: number;
  today_count: number;
  next_date: string | null;
  min_duration_minutes: number | null;
  min_fare: number | null;
}

type PairAgg = {
  originId: string;
  destId: string;
  originName: string;
  destName: string;
  durationMinutes: number | null;
  count: number;
  todayCount: number;
  nextDateIso: string | null;
  imageUrl: string | null;
  minFare: number | null;
};

/**
 * Same aggregation as BusConnect-web's lib/popular-routes.ts, adapted to a
 * plain client-side Supabase read (no Next.js unstable_cache here) — every
 * published route is guaranteed to appear, ranked above ones without real
 * upcoming trips by how many trips actually exist for that corridor.
 *
 * Trip activity is counted by walking route_stops the same way
 * search_trips() does (popular_route_activity() RPC), not by a trip's own
 * route.origin_id/dest_id — a trip on a "Nittambuwa -> Colombo" route that
 * also stops at Maradana is findable by searching "Nittambuwa -> Maradana",
 * so it needs to count toward that corridor's card too.
 */
export async function listPopularRoutes(limit?: number): Promise<PopularRoute[]> {
  const byPair = new Map<string, PairAgg>();

  const [{ data: routes, error: routesErr }, { data: activity, error: activityErr }] = await Promise.all([
    supabase
      .from("routes")
      .select(
        `origin_id, dest_id, image_url,
         origin:locations!routes_origin_id_fkey ( name_en ),
         dest:locations!routes_dest_id_fkey ( name_en )`,
      ),
    supabase.rpc("popular_route_activity"),
  ]);
  if (routesErr) console.error("listPopularRoutes: could not load the route catalog —", routesErr.message);
  if (activityErr) console.error("listPopularRoutes: could not load trip activity —", activityErr.message);

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
        durationMinutes: null,
        count: 0,
        todayCount: 0,
        nextDateIso: null,
        imageUrl: r.image_url,
        minFare: null,
      });
    }
  }

  for (const row of (activity ?? []) as unknown as ActivityRow[]) {
    const existing = byPair.get(`${row.origin_id}|${row.dest_id}`);
    if (!existing) continue; // only card known catalog corridors, not every stop pair
    existing.count = row.trip_count;
    existing.todayCount = row.today_count;
    existing.nextDateIso = row.next_date;
    existing.durationMinutes = row.min_duration_minutes;
    existing.minFare = row.min_fare;
  }

  const sorted = [...byPair.values()].sort(
    (a, b) => b.count - a.count || a.originName.localeCompare(b.originName),
  );
  const mapped = sorted.map((r) => ({
    originId: r.originId,
    destId: r.destId,
    originName: r.originName,
    destName: r.destName,
    durationMinutes: r.durationMinutes,
    tripCount: r.count,
    todayCount: r.todayCount,
    nextDateIso: r.nextDateIso,
    imageUrl: r.imageUrl,
    minFare: r.minFare,
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
