import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth";
import { listMyBookings, type MyBooking } from "@/lib/tickets";
import { Spacing, BottomTabInset } from "@/constants/theme";

type Tab = "confirmed" | "pending" | "cancelled";

function tabOf(status: string): Tab {
  if (status === "confirmed") return "confirmed";
  if (status === "cancelled" || status === "refunded") return "cancelled";
  return "pending";
}

function money(n: number) {
  return `LKR ${Number(n).toLocaleString("en-LK")}`;
}
function dateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function dateOnly(iso: string) {
  return new Date(iso).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" });
}

const TAB_LABEL: Record<Tab, string> = { confirmed: "Confirmed", pending: "Pending", cancelled: "Cancelled" };
const TABS: Tab[] = ["confirmed", "pending", "cancelled"];

export default function TicketsScreen() {
  const theme = useTheme();
  const { session, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<MyBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("confirmed");

  const load = useCallback(() => {
    if (!session) return;
    listMyBookings()
      .then(setBookings)
      .catch(() => setError("Could not load your tickets."));
  }, [session]);

  useEffect(load, [load]);
  // Refresh whenever this screen regains focus (e.g. back from checkout).
  useFocusEffect(load);

  const hero = (
    <SafeAreaView edges={["top"]} style={[styles.hero, { backgroundColor: theme.brand }]}>
      <Text style={styles.heroTitle}>My Tickets</Text>
      <Text style={styles.heroSubtitle}>Track your bookings and boarding passes.</Text>
    </SafeAreaView>
  );

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {hero}
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} />
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {hero}
        <View style={styles.center}>
          <Pressable onPress={() => router.push({ pathname: "/login", params: { next: "/tickets" } })}>
            <Text style={{ color: theme.brand, fontWeight: "600", fontSize: 16 }}>Sign in to see your tickets</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {hero}
        <View style={styles.center}>
          <Text style={{ color: theme.textSecondary }}>{error}</Text>
        </View>
      </View>
    );
  }

  if (!bookings) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {hero}
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} />
        </View>
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {hero}
        <View style={[styles.center, { gap: Spacing.three }]}>
          <Text style={{ color: theme.textSecondary }}>You haven&apos;t booked any trips yet.</Text>
          <Pressable
            onPress={() => router.push("/")}
            style={[styles.primaryButton, { backgroundColor: theme.brand }]}
          >
            <Text style={styles.primaryButtonText}>Search buses</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const counts: Record<Tab, number> = {
    confirmed: bookings.filter((b) => tabOf(b.status) === "confirmed").length,
    pending: bookings.filter((b) => tabOf(b.status) === "pending").length,
    cancelled: bookings.filter((b) => tabOf(b.status) === "cancelled").length,
  };
  const shown = bookings.filter((b) => tabOf(b.status) === tab);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {hero}
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[
                styles.tabButton,
                { backgroundColor: tab === t ? theme.brand : theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: tab === t ? "#fff" : theme.text, fontWeight: "600", fontSize: 13 }}>
                {TAB_LABEL[t]} {counts[t]}
              </Text>
            </Pressable>
          ))}
        </View>

        {shown.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text style={{ color: theme.textSecondary }}>No {TAB_LABEL[tab].toLowerCase()} bookings.</Text>
          </View>
        ) : (
          shown.map((b) => <TicketCard key={b.id} b={b} theme={theme} />)
        )}
      </ScrollView>
    </View>
  );
}

function TicketCard({ b, theme }: { b: MyBooking; theme: ReturnType<typeof useTheme> }) {
  const [open, setOpen] = useState(false);
  const t = tabOf(b.status);
  const boarded = b.ticketStatus === "used";

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.badgeRow}>
        <Badge label={TAB_LABEL[t]} tone={t} />
        {b.busClass && <Badge label={b.busClass.replace("_", " ")} tone="class" />}
        {boarded && <Badge label="Boarded" tone="confirmed" />}
      </View>

      <Text style={[styles.routeName, { color: theme.text }]}>{b.routeName ?? b.operatorName}</Text>
      <Text style={{ color: theme.textSecondary, marginTop: 4 }}>
        {dateTime(b.departAt)} · {b.operatorName}
        {b.regNo ? ` · ${b.regNo}` : ""}
      </Text>

      <View style={[styles.statsGrid, { borderTopColor: theme.border }]}>
        <Stat label="Booking code" value={b.code} theme={theme} />
        <Stat label={b.seats.length === 1 ? "Seat" : "Seats"} value={b.seats.join(", ")} theme={theme} />
        <Stat label="Total paid" value={t === "confirmed" ? money(b.amount) : "—"} theme={theme} />
        <Stat label="Booked on" value={dateOnly(b.createdAt)} theme={theme} />
      </View>

      <View style={{ marginTop: Spacing.three }}>
        {t === "confirmed" && b.qrSignature ? (
          <Pressable
            onPress={() => setOpen((v) => !v)}
            style={[styles.primaryButton, { backgroundColor: theme.brand, alignSelf: "flex-start" }]}
          >
            <Text style={styles.primaryButtonText}>{open ? "Hide QR" : "Show QR ticket"}</Text>
          </Pressable>
        ) : t === "pending" ? (
          <Pressable
            onPress={() => router.push(`/checkout/${b.id}`)}
            style={[styles.primaryButton, { backgroundColor: theme.brand, alignSelf: "flex-start" }]}
          >
            <Text style={styles.primaryButtonText}>Pay now</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push(`/bookings/${b.id}`)}
            style={[styles.secondaryButton, { borderColor: theme.border, alignSelf: "flex-start" }]}
          >
            <Text style={{ color: theme.text, fontWeight: "600" }}>View booking</Text>
          </Pressable>
        )}
      </View>

      {open && b.qrSignature && (
        <View style={[styles.qrWrap, { borderTopColor: theme.border }]}>
          <View style={[styles.qrBox, { borderColor: theme.border }]}>
            <QRCode value={b.qrSignature} size={200} />
          </View>
          <Text style={[styles.qrHint, { color: theme.textSecondary }]}>
            Show this at boarding · covers all {b.seats.length} seat{b.seats.length === 1 ? "" : "s"}
          </Text>
        </View>
      )}
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: Tab | "class" }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    confirmed: { bg: "#d1fae5", fg: "#047857" },
    pending: { bg: "#fef3c7", fg: "#b45309" },
    cancelled: { bg: "#e4e4e7", fg: "#52525b" },
    class: { bg: "#e6eefb", fg: "#004aad" },
  };
  const c = colors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.fg, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>{label}</Text>
    </View>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.stat}>
      <Text style={{ color: theme.textSecondary, fontSize: 11, textTransform: "uppercase", fontWeight: "600" }}>
        {label}
      </Text>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700", marginTop: 2 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
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
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: Spacing.one },
  container: { flexGrow: 1, padding: Spacing.four, paddingBottom: Spacing.four + BottomTabInset, gap: Spacing.three },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", gap: Spacing.two },
  tabButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: Spacing.five, alignItems: "center" },
  card: { borderWidth: 1, borderRadius: 16, padding: Spacing.four },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  routeName: { fontSize: 17, fontWeight: "800", marginTop: 10 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  stat: { minWidth: "42%" },
  primaryButton: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  secondaryButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  qrWrap: {
    alignItems: "center",
    marginTop: Spacing.four,
    paddingTop: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  qrBox: { borderWidth: 1, borderRadius: 16, padding: 12, backgroundColor: "#fff" },
  qrHint: { fontSize: 12, marginTop: Spacing.two, textAlign: "center" },
});
