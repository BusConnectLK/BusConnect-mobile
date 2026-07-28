import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { getTripRoute, getTripLive, ApiError, type TripRoute, type TripLive } from "@/lib/api";
import { TrackingMap, type BusPosition } from "@/components/tracking-map";
import { Banner } from "@/components/banner";
import { Spacing } from "@/constants/theme";

const STALE_MS = 35_000; // no fresh point for this long → "reconnecting"
const POLL_MS = 20_000; // safety net behind realtime

type SheetTone = "live" | "paused" | "stale" | "idle";

export default function TrackScreen() {
  const theme = useTheme();
  const { id, stopId, routeName, operatorName } = useLocalSearchParams<{
    id: string;
    stopId?: string;
    routeName?: string;
    operatorName?: string;
  }>();

  const [route, setRoute] = useState<TripRoute | null>(null);
  const [live, setLive] = useState<TripLive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Route line + stops — fetched once, static.
  useEffect(() => {
    if (!id) return;
    getTripRoute(id)
      .then(setRoute)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the route."));
  }, [id]);

  // Live position + status/sharing — an initial fetch, then re-fetched on every
  // realtime event (new GPS point or a status/sharing change) instead of
  // parsing PostGIS geometry off the wire, plus a slow poll as a safety net.
  const refresh = useCallback(() => {
    if (!id) return;
    getTripLive(id, stopId)
      .then(setLive)
      .catch(() => {
        /* transient — next event/poll retries */
      });
  }, [id, stopId]);

  useEffect(() => {
    if (!id) return;
    refresh();
    const channel = supabase
      .channel(`trip-track:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trip_gps", filter: `trip_id=eq.${id}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${id}` },
        refresh,
      )
      .subscribe();
    const poll = setInterval(refresh, POLL_MS);
    // Tick so the "last seen" staleness re-evaluates without a new event.
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [id, refresh]);

  const position = useMemo<BusPosition | null>(
    () => (live?.tracking ? { lat: live.lat, lng: live.lng } : null),
    [live],
  );

  const boardingName = useMemo(
    () => route?.stops.find((s) => s.route_stop_id === stopId)?.name ?? null,
    [route, stopId],
  );

  const sheet = useMemo(() => deriveSheet(live, boardingName, now), [live, boardingName, now]);

  if (error && !route) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <View style={{ width: "100%", paddingHorizontal: Spacing.four }}>
          <Banner tone="error" message={error} />
        </View>
        <Pressable onPress={() => router.back()} style={{ marginTop: Spacing.four }}>
          <Text style={{ color: theme.brand, fontWeight: "600" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!route) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TrackingMap route={route} boardingStopId={stopId ?? ""} position={position} />

      {/* Top bar over the map */}
      <SafeAreaView edges={["top"]} style={styles.topBar} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </Pressable>
        {routeName ? (
          <View style={styles.routePill}>
            <Text style={styles.routePillText} numberOfLines={1}>
              {routeName}
            </Text>
          </View>
        ) : null}
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {/* Bottom sheet */}
      <SafeAreaView edges={["bottom"]} style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />

          <View style={styles.statusRow}>
            <StatusDot tone={sheet.tone} />
            <Text style={[styles.statusLabel, { color: toneColor(sheet.tone) }]}>{sheet.label}</Text>
          </View>

          {sheet.etaMinutes != null ? (
            <View style={styles.heroRow}>
              <Text style={[styles.etaBig, { color: theme.text }]}>{sheet.etaMinutes}</Text>
              <Text style={[styles.etaUnit, { color: theme.text }]}> min</Text>
              {boardingName ? (
                <Text style={[styles.etaTo, { color: theme.textSecondary }]}>  to {boardingName}</Text>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.heroTitle, { color: theme.text }]}>{sheet.title}</Text>
          )}

          {sheet.sub ? <Text style={[styles.sub, { color: theme.textSecondary }]}>{sheet.sub}</Text> : null}

          <View style={[styles.metaRow, { borderTopColor: theme.border }]}>
            <Ionicons name="bus-outline" size={15} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }} numberOfLines={1}>
              {operatorName ?? "Your bus"}
            </Text>
            {sheet.speedKmh != null ? (
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{sheet.speedKmh} km/h</Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

interface SheetState {
  tone: SheetTone;
  label: string;
  title: string;
  sub: string | null;
  etaMinutes: number | null;
  speedKmh: number | null;
}

function deriveSheet(live: TripLive | null, boardingName: string | null, now: number): SheetState {
  if (!live) return { tone: "idle", label: "Loading", title: "Locating your bus…", sub: null, etaMinutes: null, speedKmh: null };

  const status = live.status ?? "scheduled";
  const sharing = live.sharing ?? true;

  if (status === "arrived")
    return { tone: "idle", label: "Completed", title: "Trip completed", sub: "This bus has finished its trip.", etaMinutes: null, speedKmh: null };
  if (status === "cancelled")
    return { tone: "idle", label: "Cancelled", title: "Trip cancelled", sub: null, etaMinutes: null, speedKmh: null };
  if (status === "scheduled")
    return {
      tone: "idle",
      label: "Not started",
      title: "Waiting to depart",
      sub: "Live tracking begins when the bus starts boarding.",
      etaMinutes: null,
      speedKmh: null,
    };

  // boarding / departed
  if (!sharing)
    return { tone: "paused", label: "Paused", title: "Location paused", sub: "The driver paused live location sharing.", etaMinutes: null, speedKmh: null };

  if (!live.tracking)
    return {
      tone: "idle",
      label: status === "boarding" ? "Boarding" : "Starting",
      title: status === "boarding" ? "Boarding at the stop" : "Starting the trip",
      sub: "Waiting for the bus's location…",
      etaMinutes: null,
      speedKmh: null,
    };

  const ageMs = now - new Date(live.recorded_at).getTime();
  if (ageMs > STALE_MS) {
    const mins = Math.max(1, Math.round(ageMs / 60000));
    return { tone: "stale", label: "Reconnecting", title: "Signal lost", sub: `Last seen ${mins} min ago`, etaMinutes: null, speedKmh: null };
  }

  const speedKmh = live.speed_kmh != null ? Math.round(live.speed_kmh) : null;
  return {
    tone: "live",
    label: "Live",
    title: status === "boarding" ? "Boarding at the stop" : "On the way",
    sub: status === "boarding" ? "The bus is at the stop, boarding passengers." : boardingName ? null : "Heading to your stop.",
    etaMinutes: live.eta_minutes ?? null,
    speedKmh,
  };
}

function toneColor(tone: SheetTone) {
  switch (tone) {
    case "live":
      return "#059669";
    case "paused":
    case "stale":
      return "#b45309";
    default:
      return "#9ca3af";
  }
}

function StatusDot({ tone }: { tone: SheetTone }) {
  return <View style={[styles.dot, { backgroundColor: toneColor(tone) }]} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  routePill: {
    flex: 1,
    marginHorizontal: Spacing.two,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  routePillText: { color: "#111", fontWeight: "700", fontSize: 13 },
  sheetWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: Spacing.three },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  heroRow: { flexDirection: "row", alignItems: "baseline", marginTop: Spacing.two },
  etaBig: { fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  etaUnit: { fontSize: 20, fontWeight: "700" },
  etaTo: { fontSize: 15, fontWeight: "500" },
  heroTitle: { fontSize: 22, fontWeight: "800", marginTop: Spacing.two, letterSpacing: -0.3 },
  sub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
