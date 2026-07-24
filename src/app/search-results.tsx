import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { searchTrips, type TripSearchResult } from "@/lib/api";
import { Spacing } from "@/constants/theme";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" });
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
      .catch(() => setError("Could not load trips. Pull down to try again."));
  }, [from, to, date]);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>{error}</Text>
      </View>
    );
  }

  if (!results) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>No buses found for this route and date.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}
      data={results}
      keyExtractor={(item) => `${item.trip_id}-${item.from_stop_id}-${item.to_stop_id}`}
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/trips/[id]",
              params: { id: item.trip_id, from: item.from_stop_id, to: item.to_stop_id },
            })
          }
          style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        >
          <View style={styles.rowBetween}>
            <Text style={[styles.operator, { color: theme.text }]}>{item.operator_name}</Text>
            <Text style={[styles.fare, { color: theme.brand }]}>LKR {item.fare.toLocaleString("en-LK")}</Text>
          </View>
          <Text style={{ color: theme.textSecondary, marginTop: 2 }}>
            {item.bus_type_name} · {item.bus_type_class.replace("_", " ")}
          </Text>
          <View style={[styles.rowBetween, { marginTop: Spacing.two }]}>
            <Text style={{ color: theme.text, fontWeight: "600" }}>{formatTime(item.boarding_at)}</Text>
            <Text style={{ color: theme.textSecondary }}>→</Text>
            <Text style={{ color: theme.text, fontWeight: "600" }}>{formatTime(item.drop_at)}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.four },
  card: { borderWidth: 1, borderRadius: 14, padding: Spacing.three },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  operator: { fontSize: 16, fontWeight: "700" },
  fare: { fontSize: 16, fontWeight: "800" },
});
