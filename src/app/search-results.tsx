import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { searchTrips, ApiError, type TripSearchResult } from "@/lib/api";
import { Banner } from "@/components/banner";
import { Spacing } from "@/constants/theme";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-LK", { weekday: "short", day: "numeric", month: "short" });
}

function duration(depart: string, arrive: string) {
  const mins = Math.round((new Date(arrive).getTime() - new Date(depart).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m ? ` ${m}m` : ""}`;
}

function routeEndpoints(routeName: string): [string, string] {
  const parts = routeName.split(/\s*-\s*/);
  if (parts.length >= 2) return [parts[0], parts[parts.length - 1]];
  return [routeName, ""];
}

export default function SearchResultsScreen() {
  const theme = useTheme();
  const { from, to, date } = useLocalSearchParams<{ from: string; to: string; date: string }>();
  const [results, setResults] = useState<TripSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!from || !to || !date) return;
    searchTrips({ from, to, date })
      .then(setResults)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load trips. Pull down to try again."));
  }, [from, to, date]);

  const hero = (
    <SafeAreaView edges={["top"]} style={[styles.hero, { backgroundColor: theme.brand }]}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>
      <Text style={styles.heroTitle}>Search results</Text>
      {date && <Text style={styles.heroSubtitle}>{formatDate(date)}</Text>}
    </SafeAreaView>
  );

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {hero}
        <View style={styles.center}>
          <View style={{ width: "100%" }}>
            <Banner tone="error" message={error} />
          </View>
        </View>
      </View>
    );
  }

  if (!results) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {hero}
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} />
        </View>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {hero}
        <View style={styles.center}>
          <Text style={{ color: theme.textSecondary }}>No buses found for this route and date.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {hero}
      <FlatList
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}
        data={results}
        keyExtractor={(item) => `${item.trip_id}-${item.from_stop_id}-${item.to_stop_id}`}
        renderItem={({ item }) => <TripCard trip={item} theme={theme} />}
      />
    </View>
  );
}

function TripCard({ trip, theme }: { trip: TripSearchResult; theme: ReturnType<typeof useTheme> }) {
  const dur = duration(trip.boarding_at, trip.drop_at);
  const overnight = new Date(trip.drop_at).toDateString() !== new Date(trip.boarding_at).toDateString();
  const [origin, destination] = routeEndpoints(trip.route_name);
  const amenities = trip.bus_amenities.slice(0, 4);
  const image = trip.bus_images[0];

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/trips/[id]",
          params: { id: trip.trip_id, from: trip.from_stop_id, to: trip.to_stop_id },
        })
      }
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
    >
      <View style={styles.thumbWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            {trip.operator_logo_url ? (
              <Image source={{ uri: trip.operator_logo_url }} style={styles.thumbLogo} />
            ) : (
              <Text style={styles.thumbInitial}>{trip.operator_name.slice(0, 1)}</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.badgeRow}>
          <View style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
            <Text style={{ color: theme.brand, fontSize: 11, fontWeight: "700" }}>
              {trip.bus_type_class.replace("_", " ")}
            </Text>
          </View>
          <View style={styles.operatorRow}>
            <Ionicons name="bus-outline" size={13} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
              {trip.operator_name} · {trip.bus_reg_no}
            </Text>
          </View>
        </View>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={11} color="#f59e0b" />
          <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: "600" }}>
            {trip.operator_rating.toFixed(1)} · {trip.operator_reliability_score.toFixed(0)}%
          </Text>
        </View>

        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.time, { color: theme.text }]}>{formatTime(trip.boarding_at)}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {origin}
            </Text>
          </View>
          <View style={styles.durationCol}>
            <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: "600" }}>{dur}</Text>
            {overnight && (
              <Text style={{ color: "#b45309", fontSize: 9, fontWeight: "700", marginTop: 1 }}>+1 day</Text>
            )}
            <View style={styles.durationLine}>
              <View style={[styles.durationDash, { backgroundColor: theme.border }]} />
              <Ionicons name="arrow-forward" size={12} color={theme.textSecondary} />
              <View style={[styles.durationDash, { backgroundColor: theme.border }]} />
            </View>
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={[styles.time, { color: theme.text }]}>{formatTime(trip.drop_at)}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {destination}
            </Text>
          </View>
        </View>

        {amenities.length > 0 && (
          <View style={styles.amenitiesRow}>
            {amenities.map((a) => (
              <View key={a} style={[styles.amenityChip, { backgroundColor: theme.backgroundSelected }]}>
                <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{a}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.footerRow, { borderTopColor: theme.border }]}>
          <View>
            <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
              LKR
            </Text>
            <Text style={[styles.fare, { color: theme.brand }]}>{trip.fare.toLocaleString("en-LK")}</Text>
          </View>
          <View style={[styles.selectButton, { backgroundColor: theme.brand }]}>
            <Text style={styles.selectButtonText}>Select seats</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: { alignSelf: "flex-start", marginBottom: Spacing.two },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: Spacing.one },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.four },
  card: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  thumbWrap: { width: "100%", height: 120 },
  thumb: { width: "100%", height: "100%" },
  thumbFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#004AAD" },
  thumbLogo: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#fff" },
  thumbInitial: { color: "#fff", fontSize: 26, fontWeight: "800" },
  cardBody: { padding: Spacing.three },
  badgeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Spacing.two },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  operatorRow: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing.three, gap: Spacing.two },
  time: { fontSize: 19, fontWeight: "800" },
  durationCol: { alignItems: "center" },
  durationLine: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, width: 64 },
  durationDash: { height: 1, flex: 1 },
  amenitiesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.three },
  amenityChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fare: { fontSize: 20, fontWeight: "800" },
  selectButton: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  selectButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
