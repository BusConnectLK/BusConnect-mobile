import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth";
import { listLocations, type Location } from "@/lib/locations";
import { Spacing } from "@/constants/theme";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-LK", { weekday: "short", day: "numeric", month: "short" });
}

export default function SearchScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [from, setFrom] = useState<Location | null>(null);
  const [to, setTo] = useState<Location | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [loading, setLoading] = useState(true);

  const firstName = (session?.user.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  useEffect(() => {
    void listLocations().then((data) => {
      setLocations(data);
      setFrom(data[0] ?? null);
      setTo(data[1] ?? data[0] ?? null);
      setLoading(false);
    });
  }, []);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  function search() {
    if (!from || !to) return;
    router.push({
      pathname: "/search-results",
      params: { from: from.id, to: to.id, date: date.toISOString().slice(0, 10) },
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={["top"]} style={[styles.hero, { backgroundColor: theme.brand }]}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.greeting}>{firstName ? `Hello, ${firstName}` : "Every Journey, Connected."}</Text>
              <Text style={styles.tagline}>Search live seats, book securely, board with a QR ticket.</Text>
            </View>
            <Pressable onPress={() => router.push("/profile")} hitSlop={10}>
              <Ionicons name="person-circle" size={40} color="rgba(255,255,255,0.95)" />
            </Pressable>
          </View>
        </SafeAreaView>

        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.six }} color={theme.brand} />
        ) : (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border, shadowColor: theme.text },
            ]}
          >
            <View style={styles.routeRow}>
              <View style={styles.dotsColumn}>
                <View style={[styles.dot, { backgroundColor: theme.brand }]} />
                <View style={[styles.dotLine, { backgroundColor: theme.border }]} />
                <View style={[styles.dot, styles.dotOutline, { borderColor: theme.brand }]} />
              </View>

              <View style={styles.routeFields}>
                <Pressable onPress={() => setPicking("from")} style={styles.routeField}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>From</Text>
                  <Text style={[styles.fieldValue, { color: theme.text }]} numberOfLines={1}>
                    {from?.name_en ?? "Select"}
                  </Text>
                </Pressable>
                <View style={[styles.routeDivider, { backgroundColor: theme.border }]} />
                <Pressable onPress={() => setPicking("to")} style={styles.routeField}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>To</Text>
                  <Text style={[styles.fieldValue, { color: theme.text }]} numberOfLines={1}>
                    {to?.name_en ?? "Select"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={swap}
                hitSlop={10}
                style={[styles.swapButton, { backgroundColor: theme.backgroundSelected }]}
              >
                <Ionicons name="swap-vertical" size={18} color={theme.brand} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[styles.dateField, { borderColor: theme.border }]}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
              <View style={{ marginLeft: Spacing.two }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Date</Text>
                <Text style={[styles.fieldValue, { color: theme.text }]}>{formatDate(date)}</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={search}
              disabled={!from || !to}
              style={[styles.searchButton, { backgroundColor: theme.brand, opacity: !from || !to ? 0.6 : 1 }]}
            >
              <Ionicons name="search" size={17} color="#fff" />
              <Text style={styles.searchButtonText}>Search buses</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          minimumDate={new Date(todayIso())}
          onChange={(_event, selected) => {
            setShowDatePicker(false);
            if (selected) setDate(selected);
          }}
        />
      )}

      {picking && (
        <LocationPicker
          locations={locations}
          theme={theme}
          onSelect={(loc) => {
            if (picking === "from") setFrom(loc);
            else setTo(loc);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </View>
  );
}

function LocationPicker({
  locations,
  theme,
  onSelect,
  onClose,
}: {
  locations: Location[];
  theme: ReturnType<typeof useTheme>;
  onSelect: (loc: Location) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = locations.filter((l) => l.name_en.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, styles.overlay]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.searchInputWrap, { borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={17} color={theme.textSecondary} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search locations…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        <ScrollView>
          {filtered.map((loc) => (
            <Pressable key={loc.id} onPress={() => onSelect(loc)} style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
              <Text style={{ color: theme.text, fontSize: 16, marginLeft: Spacing.two }}>{loc.name_en}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: Spacing.six },
  hero: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six + Spacing.two,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: 24, fontWeight: "800", color: "#fff", letterSpacing: -0.3, maxWidth: 240 },
  tagline: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: Spacing.one, maxWidth: 260, lineHeight: 18 },
  card: {
    marginHorizontal: Spacing.four,
    marginTop: -Spacing.six,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  routeRow: { flexDirection: "row", alignItems: "stretch" },
  dotsColumn: { width: 16, alignItems: "center", paddingVertical: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotOutline: { backgroundColor: "transparent", borderWidth: 2 },
  dotLine: { width: 2, flex: 1, marginVertical: 4 },
  routeFields: { flex: 1, marginLeft: Spacing.two },
  routeField: { paddingVertical: Spacing.two },
  routeDivider: { height: StyleSheet.hairlineWidth },
  fieldLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { fontSize: 16, fontWeight: "700", marginTop: 3 },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
  searchButton: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.one,
  },
  searchButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  overlay: { backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: "20%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.three, fontSize: 16 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#8883",
  },
});
