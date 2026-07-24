import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  getTrip,
  getSeatmap,
  createHold,
  createBooking,
  ApiError,
  type TripDetail,
  type SeatMap,
  type SeatState,
} from "@/lib/api";
import { layoutToGrid } from "@/lib/seat-layout";
import { LiveMap } from "@/components/live-map";
import { Spacing } from "@/constants/theme";

const SEAT_COLOR = {
  male: "#1e3a5f",
  female: "#7a2048",
  pending: "#c17a1f",
  blocked: "#6b7280",
};

export default function TripDetailScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { id, from, to } = useLocalSearchParams<{ id: string; from: string; to: string }>();

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [seatmap, setSeatmap] = useState<SeatMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [genders, setGenders] = useState<Map<string, "male" | "female">>(new Map());
  const [genderPromptSeat, setGenderPromptSeat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getTrip(id), getSeatmap(id)])
      .then(([t, s]) => {
        setTrip(t);
        setSeatmap(s);
      })
      .catch(() => setError("Could not load this trip."));
  }, [id]);

  // Live seat updates via Supabase Realtime, same pattern as the web app.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`seat_holds:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seat_holds", filter: `trip_id=eq.${id}` },
        () => {
          void getSeatmap(id).then(setSeatmap);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  const seatStates = useMemo(() => {
    const map = new Map<string, SeatState>();
    for (const s of seatmap?.seats ?? []) map.set(s.seat_no, s);
    return map;
  }, [seatmap]);

  const grid = useMemo(
    () => layoutToGrid(seatmap?.layout ?? trip?.bus.bus_type.layout_json ?? null, trip?.bus.bus_type.seat_count ?? 40),
    [seatmap, trip],
  );

  const fare = trip?.fares.find((f) => f.from_stop_id === from && f.to_stop_id === to)?.fare ?? trip?.base_fare ?? 0;
  const total = selected.size * fare;

  function seatKind(label: string): "available" | "selected" | "male" | "female" | "pending" | "blocked" {
    if (selected.has(label)) return "selected";
    const state = seatStates.get(label);
    if (!state) return "available";
    if (state.status === "blocked") return "blocked";
    if (state.status === "held") return "pending";
    return state.gender === "female" ? "female" : "male";
  }

  function tapSeat(label: string) {
    if (seatStates.has(label)) return;
    if (selected.has(label)) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(label);
        return next;
      });
      setGenders((prev) => {
        const next = new Map(prev);
        next.delete(label);
        return next;
      });
      return;
    }
    setGenderPromptSeat(label);
  }

  function pickGender(gender: "male" | "female") {
    if (!genderPromptSeat) return;
    setSelected((prev) => new Set(prev).add(genderPromptSeat));
    setGenders((prev) => new Map(prev).set(genderPromptSeat, gender));
    setGenderPromptSeat(null);
  }

  async function handleContinue() {
    if (selected.size === 0 || !id || !from || !to) return;
    if (!session) {
      router.push({ pathname: "/login", params: { next: `/trips/${id}?from=${from}&to=${to}` } });
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const hold = await createHold(session.access_token, {
        tripId: id,
        seats: [...selected].map((seatNo) => ({ seatNo, gender: genders.get(seatNo) })),
      });
      const booking = await createBooking(session.access_token, {
        holdGroup: hold.hold_group,
        fromStopId: from,
        toStopId: to,
      });
      router.push({ pathname: "/checkout/[id]", params: { id: booking.booking_id } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError("Some of those seats were just taken. Please pick again.");
        setSelected(new Set());
        setGenders(new Map());
        if (id) void getSeatmap(id).then(setSeatmap);
      } else {
        setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (error && !trip) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>{error}</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.three, paddingBottom: 140 }}>
        <Text style={[styles.busName, { color: theme.text }]}>{trip.bus.operator?.name}</Text>
        <Text style={{ color: theme.textSecondary, marginTop: 2 }}>
          {trip.bus.bus_type.name} · {trip.bus.reg_no}
        </Text>

        <View style={{ marginTop: Spacing.three }}>
          <LiveMap
            tripId={trip.id}
            stopId={from ?? ""}
            active={trip.status === "boarding" || trip.status === "departed"}
          />
        </View>

        <View style={styles.legend}>
          <LegendItem color="transparent" border={theme.border} label="Available" />
          <LegendItem color={theme.brand} label="Selected" />
          <LegendItem color={SEAT_COLOR.male} label="Male" />
          <LegendItem color={SEAT_COLOR.female} label="Female" />
          <LegendItem color={SEAT_COLOR.pending} label="Pending" />
          <LegendItem color={SEAT_COLOR.blocked} label="Unavailable" />
        </View>

        <View style={[styles.seatCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {grid.map((row, r) => (
            <View key={r} style={styles.seatRow}>
              {row.map((label, ci) => {
                if (label === null) return <View key={ci} style={styles.aisle} />;
                const kind = seatKind(label);
                const taken = kind !== "available" && kind !== "selected";
                return (
                  <Pressable
                    key={ci}
                    disabled={taken || busy}
                    onPress={() => tapSeat(label)}
                    style={[
                      styles.seat,
                      { borderColor: theme.border },
                      kind === "selected" && { backgroundColor: theme.brand, borderColor: theme.brand },
                      kind === "male" && { backgroundColor: SEAT_COLOR.male, borderColor: SEAT_COLOR.male },
                      kind === "female" && { backgroundColor: SEAT_COLOR.female, borderColor: SEAT_COLOR.female },
                      kind === "pending" && { backgroundColor: SEAT_COLOR.pending, borderColor: SEAT_COLOR.pending },
                      kind === "blocked" && { backgroundColor: SEAT_COLOR.blocked, borderColor: SEAT_COLOR.blocked },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: kind === "available" ? theme.text : "#fff",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {error && <Text style={{ color: "#dc2626", marginTop: Spacing.three }}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
            {selected.size > 0 ? [...selected].join(", ") : "No seats selected"}
          </Text>
          <Text style={{ color: theme.brand, fontWeight: "800", fontSize: 18 }}>
            LKR {total.toLocaleString("en-LK")}
          </Text>
        </View>
        <Pressable
          onPress={handleContinue}
          disabled={selected.size === 0 || busy}
          style={[styles.continueButton, { backgroundColor: theme.brand, opacity: selected.size === 0 || busy ? 0.6 : 1 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueText}>Continue</Text>}
        </Pressable>
      </View>

      <Modal visible={!!genderPromptSeat} transparent animationType="fade" onRequestClose={() => setGenderPromptSeat(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setGenderPromptSeat(null)}>
          <View style={[styles.genderSheet, { backgroundColor: theme.backgroundElement }]}>
            <Text style={{ color: theme.text, fontWeight: "700", marginBottom: Spacing.three, textAlign: "center" }}>
              Seat {genderPromptSeat}
            </Text>
            <View style={{ flexDirection: "row", gap: Spacing.two }}>
              <Pressable
                onPress={() => pickGender("male")}
                style={[styles.genderButton, { borderColor: SEAT_COLOR.male }]}
              >
                <Text style={{ color: SEAT_COLOR.male, fontWeight: "700" }}>Male</Text>
              </Pressable>
              <Pressable
                onPress={() => pickGender("female")}
                style={[styles.genderButton, { borderColor: SEAT_COLOR.female }]}
              >
                <Text style={{ color: SEAT_COLOR.female, fontWeight: "700" }}>Female</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function LegendItem({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color, borderColor: border ?? color }]} />
      <Text style={{ fontSize: 12, color: "#8a8f98" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  busName: { fontSize: 20, fontWeight: "800" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.three, marginTop: Spacing.three, marginBottom: Spacing.three },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 4, borderWidth: 1 },
  seatCard: { borderWidth: 1, borderRadius: 16, padding: Spacing.three, alignItems: "center", gap: Spacing.two },
  seatRow: { flexDirection: "row", gap: Spacing.two },
  seat: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  aisle: { width: 24 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.three,
    borderTopWidth: 1,
  },
  continueButton: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  continueText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  genderSheet: { borderRadius: 16, padding: Spacing.four, width: 260 },
  genderButton: { flex: 1, borderWidth: 2, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
});
