import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import {
  getTripRoute,
  getTripLive,
  getTrip,
  getTripCrew,
  ApiError,
  type TripRoute,
  type TripLive,
  type TripDetail,
  type TripCrew,
  type CrewMember,
} from "@/lib/api";
import { TrackingMap, type BusPosition } from "@/components/tracking-map";
import { Banner } from "@/components/banner";
import { Spacing } from "@/constants/theme";

const STALE_MS = 35_000; // no fresh point for this long → "reconnecting"
const POLL_MS = 20_000; // safety net behind realtime
const CREW_REFRESH_MS = 4 * 60 * 1000; // crew photo URLs are signed for 300s
const NOTIFY_ETA_MIN = 3; // fire the "almost here" alert at this ETA or below

type SheetTone = "live" | "paused" | "stale" | "idle";
type Theme = ReturnType<typeof useTheme>;

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
  const [tripDetail, setTripDetail] = useState<TripDetail | null>(null);
  const [crew, setCrew] = useState<TripCrew | null>(null);
  const [notifyNear, setNotifyNear] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const notifiedRef = useRef(false);

  // Route line + stops — fetched once, static.
  useEffect(() => {
    if (!id) return;
    getTripRoute(id)
      .then(setRoute)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the route."));
  }, [id]);

  // Bus/operator details — fetched once, static for the trip.
  useEffect(() => {
    if (!id) return;
    getTrip(id)
      .then(setTripDetail)
      .catch(() => {
        /* the info card just stays hidden if this fails — not critical */
      });
  }, [id]);

  // Driver/conductor — the profile photo is a 5-min signed URL, so refresh
  // it periodically instead of fetching once and letting the image break.
  useEffect(() => {
    if (!id) return;
    let active = true;
    function load() {
      getTripCrew(id)
        .then((c) => {
          if (active) setCrew(c);
        })
        .catch(() => {
          /* crew card just stays hidden if this fails */
        });
    }
    load();
    const interval = setInterval(load, CREW_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id]);

  // Reset the "almost here" alert when tracking a different trip.
  useEffect(() => {
    notifiedRef.current = false;
  }, [id]);

  useEffect(() => {
    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync("proximity", {
        name: "Bus arrival alerts",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  }, []);

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

  const toggleNotify = useCallback(async () => {
    if (!notifyNear) {
      const perm = await Notifications.requestPermissionsAsync();
      if (perm.status !== "granted") return;
    }
    setNotifyNear((v) => !v);
    notifiedRef.current = false;
  }, [notifyNear]);

  // Fires once per trip when the ETA first drops to the threshold — a ref
  // flag (not state) tracks "already sent" so this can't re-fire on every
  // subsequent live update while still under the threshold.
  useEffect(() => {
    if (!notifyNear || notifiedRef.current) return;
    if (sheet.tone !== "live" || sheet.etaMinutes == null) return;
    if (sheet.etaMinutes > NOTIFY_ETA_MIN) return;
    notifiedRef.current = true;
    void Notifications.scheduleNotificationAsync({
      content: {
        title: "Your bus is almost here",
        body: boardingName
          ? `Arriving at ${boardingName} in about ${sheet.etaMinutes} min.`
          : `Arriving in about ${sheet.etaMinutes} min.`,
      },
      trigger: null,
    });
  }, [notifyNear, sheet.tone, sheet.etaMinutes, boardingName]);

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
          <Pressable onPress={() => setCollapsed((v) => !v)} hitSlop={8}>
            <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          </Pressable>

          <View style={styles.statusRow}>
            <View style={styles.statusRowLeft}>
              <StatusDot tone={sheet.tone} />
              <Text style={[styles.statusLabel, { color: toneColor(sheet.tone) }]}>{sheet.label}</Text>
            </View>
            <View style={styles.statusRowLeft}>
              <Pressable
                onPress={toggleNotify}
                hitSlop={8}
                style={[
                  styles.notifyBtn,
                  { borderColor: notifyNear ? theme.brand : theme.border },
                  notifyNear && { backgroundColor: theme.brandSoft },
                ]}
              >
                <Ionicons
                  name={notifyNear ? "notifications" : "notifications-outline"}
                  size={13}
                  color={notifyNear ? theme.brand : theme.textSecondary}
                />
                <Text style={[styles.notifyBtnText, { color: notifyNear ? theme.brand : theme.textSecondary }]}>
                  {notifyNear ? "Notifying" : "Notify me"}
                </Text>
              </Pressable>
              <Pressable onPress={() => setCollapsed((v) => !v)} hitSlop={8}>
                <Ionicons
                  name={collapsed ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {!collapsed && (
            <>
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
                  {tripDetail ? ` · ${tripDetail.bus.reg_no}` : ""}
                </Text>
                {sheet.speedKmh != null ? (
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{sheet.speedKmh} km/h</Text>
                ) : null}
              </View>

              {(crew?.driver || crew?.conductor) && (
                <View style={styles.infoCard}>
                  <View style={styles.crewRow}>
                    {crew?.driver && <CrewChip label="Driver" member={crew.driver} theme={theme} />}
                    {crew?.conductor && <CrewChip label="Conductor" member={crew.conductor} theme={theme} />}
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function CrewChip({ label, member, theme }: { label: string; member: CrewMember; theme: Theme }) {
  return (
    <View style={styles.crewChip}>
      {member.photoUrl ? (
        <Image source={{ uri: member.photoUrl }} style={styles.crewAvatar} />
      ) : (
        <View style={[styles.crewAvatar, styles.crewAvatarPlaceholder, { backgroundColor: theme.brandSoft }]}>
          <Ionicons name="person" size={14} color={theme.brand} />
        </View>
      )}
      <View style={{ flexShrink: 1 }}>
        <Text style={[styles.crewLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.crewName, { color: theme.text }]} numberOfLines={1}>
          {member.name}
        </Text>
      </View>
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
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusRowLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  notifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  notifyBtnText: { fontSize: 11, fontWeight: "700" },
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
  infoCard: { marginTop: Spacing.three, gap: Spacing.two },
  crewRow: { flexDirection: "row", gap: Spacing.four },
  crewChip: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  crewAvatar: { width: 32, height: 32, borderRadius: 16 },
  crewAvatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  crewLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  crewName: { fontSize: 13, fontWeight: "600" },
});
