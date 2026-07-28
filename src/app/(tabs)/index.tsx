import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/hooks/use-theme";
import { useThemeMode } from "@/lib/theme-mode-context";
import { useAuth } from "@/lib/auth";
import { listLocations, type Location } from "@/lib/locations";
import { listPopularRoutes, formatDuration, type PopularRoute } from "@/lib/popular-routes";
import { NotificationBell } from "@/components/notification-bell";
import { Spacing, BottomTabInset } from "@/constants/theme";

// Date-only string in the device's local calendar day — NOT toISOString(),
// which converts to UTC first and lands on the wrong day for anyone east of
// UTC (e.g. Sri Lanka, UTC+5:30) between local midnight and the UTC rollover.
function localDateIso(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayIso() {
  return localDateIso(new Date());
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-LK", { weekday: "short", day: "numeric", month: "short" });
}

export default function SearchScreen() {
  const theme = useTheme();
  const { resolvedScheme } = useThemeMode();
  const { session } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [from, setFrom] = useState<Location | null>(null);
  const [to, setTo] = useState<Location | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [loading, setLoading] = useState(true);
  const [popularRoutes, setPopularRoutes] = useState<PopularRoute[] | null>(null);

  const firstName = (session?.user.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  useEffect(() => {
    void listLocations().then((data) => {
      setLocations(data);
      setFrom(data[0] ?? null);
      setTo(data[1] ?? data[0] ?? null);
      setLoading(false);
    });
    void listPopularRoutes(6).then(setPopularRoutes);
  }, []);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  function search() {
    if (!from || !to) return;
    router.push({
      pathname: "/search-results",
      params: { from: from.id, to: to.id, date: localDateIso(date) },
    });
  }

  function searchRoute(route: PopularRoute) {
    router.push({
      pathname: "/search-results",
      params: { from: route.originId, to: route.destId, date: todayIso() },
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={["top"]} style={[styles.hero, { backgroundColor: theme.brand }]}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{firstName ? `Hello, ${firstName}` : "Every Journey, Connected."}</Text>
              <Text style={styles.tagline}>Search live seats, book securely, board with a QR ticket.</Text>
            </View>
            <NotificationBell />
          </View>
        </SafeAreaView>

        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.six }} color={theme.brand} />
        ) : (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
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

        {popularRoutes === null ? null : popularRoutes.length > 0 ? (
          <View style={styles.popularSection}>
            <Text style={[styles.popularTitle, { color: theme.text }]}>Popular routes</Text>
            {popularRoutes.map((r) => (
              <Pressable
                key={`${r.originId}-${r.destId}`}
                onPress={() => searchRoute(r)}
                style={[styles.routeCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              >
                {r.imageUrl && <Image source={{ uri: r.imageUrl }} style={styles.routeCardImage} />}
                <View style={styles.routeCardBody}>
                  <View style={styles.routeCardHeading}>
                    <Text style={[styles.routeCardText, { color: theme.text }]} numberOfLines={1}>
                      {r.originName}
                    </Text>
                    <Ionicons name="arrow-forward" size={13} color={theme.textSecondary} />
                    <Text style={[styles.routeCardText, { color: theme.text }]} numberOfLines={1}>
                      {r.destName}
                    </Text>
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 3 }}>
                    {r.tripCount > 0
                      ? `${r.tripCount} ${r.tripCount === 1 ? "trip" : "trips"} today${
                          formatDuration(r.durationMinutes) ? ` · ${formatDuration(r.durationMinutes)}` : ""
                        }`
                      : "No buses scheduled today"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {showDatePicker && Platform.OS === "android" && (
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

      {showDatePicker && Platform.OS === "ios" && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={[StyleSheet.absoluteFill, styles.overlay]} onPress={() => setShowDatePicker(false)} />
          <View style={[styles.datePickerSheet, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.datePickerHeader}>
              <Pressable onPress={() => setShowDatePicker(false)} hitSlop={8}>
                <Text style={{ color: theme.brand, fontWeight: "700", fontSize: 15 }}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={date}
              mode="date"
              display="inline"
              themeVariant={resolvedScheme}
              accentColor={theme.brand}
              minimumDate={new Date(todayIso())}
              style={styles.datePickerNative}
              onChange={(_event, selected) => {
                if (selected) setDate(selected);
              }}
            />
          </View>
        </View>
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
  scrollContent: { flexGrow: 1, paddingBottom: Spacing.six + BottomTabInset },
  hero: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six + Spacing.two,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTopRow: { flexDirection: "row", alignItems: "flex-start" },
  greeting: { fontSize: 24, fontWeight: "800", color: "#fff", letterSpacing: -0.3, maxWidth: 240 },
  tagline: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: Spacing.one, maxWidth: 260, lineHeight: 18 },
  card: {
    marginHorizontal: Spacing.four,
    marginTop: -Spacing.six,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
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
  popularSection: { marginTop: Spacing.five, paddingHorizontal: Spacing.four, gap: Spacing.two },
  popularTitle: { fontSize: 18, fontWeight: "800", marginBottom: Spacing.one },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  routeCardImage: { width: 48, height: 48, borderRadius: 10 },
  routeCardBody: { flex: 1 },
  routeCardHeading: { flexDirection: "row", alignItems: "center", gap: 6 },
  routeCardText: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  overlay: { backgroundColor: "rgba(0,0,0,0.4)" },
  datePickerSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Spacing.six,
  },
  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  datePickerNative: { alignSelf: "center", width: 340, height: 360 },
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
