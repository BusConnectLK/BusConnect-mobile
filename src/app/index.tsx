import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/hooks/use-theme";
import { listLocations, type Location } from "@/lib/locations";
import { Spacing } from "@/constants/theme";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function SearchScreen() {
  const theme = useTheme();
  const [locations, setLocations] = useState<Location[]>([]);
  const [from, setFrom] = useState<Location | null>(null);
  const [to, setTo] = useState<Location | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [loading, setLoading] = useState(true);

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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.hero}>
        <Text style={[styles.title, { color: theme.text }]}>Every Journey, Connected.</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Search live seat availability, book securely, and get an instant QR e-ticket.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: Spacing.six }} color={theme.brand} />
      ) : (
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <FieldButton
            label="From"
            value={from?.name_en ?? "Select"}
            onPress={() => setPicking("from")}
            theme={theme}
          />
          <Pressable onPress={swap} style={styles.swapButton} hitSlop={10}>
            <Text style={{ color: theme.brand, fontWeight: "700" }}>⇅ Swap</Text>
          </Pressable>
          <FieldButton label="To" value={to?.name_en ?? "Select"} onPress={() => setPicking("to")} theme={theme} />
          <FieldButton
            label="Date"
            value={date.toDateString()}
            onPress={() => setShowDatePicker(true)}
            theme={theme}
          />

          <Pressable
            onPress={search}
            disabled={!from || !to}
            style={[styles.searchButton, { backgroundColor: theme.brand, opacity: !from || !to ? 0.6 : 1 }]}
          >
            <Text style={styles.searchButtonText}>Search buses</Text>
          </Pressable>
        </View>
      )}

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
    </SafeAreaView>
  );
}

function FieldButton({
  label,
  value,
  onPress,
  theme,
}: {
  label: string;
  value: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.field, { borderColor: theme.border }]}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: theme.text }]}>{value}</Text>
    </Pressable>
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
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search locations…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text, borderColor: theme.border }]}
        />
        {filtered.map((loc) => (
          <Pressable key={loc.id} onPress={() => onSelect(loc)} style={styles.locationRow}>
            <Text style={{ color: theme.text, fontSize: 16 }}>{loc.name_en}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingHorizontal: Spacing.four, paddingTop: Spacing.six, paddingBottom: Spacing.four },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: Spacing.two, lineHeight: 21 },
  card: {
    marginHorizontal: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  field: { borderWidth: 1, borderRadius: 12, padding: Spacing.three },
  fieldLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { fontSize: 16, fontWeight: "600", marginTop: 4 },
  swapButton: { alignSelf: "center" },
  searchButton: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: Spacing.two },
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
  searchInput: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, fontSize: 16, marginBottom: Spacing.three },
  locationRow: { paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#8883" },
});
