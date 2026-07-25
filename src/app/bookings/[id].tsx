import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth";
import { getBooking, cancelBooking, ApiError, type Booking } from "@/lib/api";
import { Spacing } from "@/constants/theme";

/** Mirrors BookingsService's refund tiers (web's cancel-button.tsx) — preview
 *  only, the server is authoritative. */
function previewRefundPct(departAt: string): number {
  const hours = (new Date(departAt).getTime() - Date.now()) / 3_600_000;
  if (hours >= 24) return 100;
  if (hours >= 3) return 50;
  return 0;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TicketScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id || !session) return;
    let cancelled = false;
    // Payment webhooks can take a beat to land — poll briefly while pending
    // rather than showing a stale "pending" state right after checkout.
    async function poll() {
      try {
        const b = await getBooking(session!.access_token, id);
        if (cancelled) return;
        setBooking(b);
        if (b.status === "pending") setTimeout(poll, 3000);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load your ticket.");
      }
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [id, session]);

  const hero = (
    <SafeAreaView edges={["top"]} style={[styles.hero, { backgroundColor: theme.brand }]}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>
      <Text style={styles.heroTitle}>Your ticket</Text>
    </SafeAreaView>
  );

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

  if (!booking) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {hero}
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} />
        </View>
      </View>
    );
  }

  const ticket = booking.tickets?.[0];
  const confirmed = booking.status === "confirmed";
  const cancellable = booking.status === "confirmed" || booking.status === "pending";

  function onCancelPress() {
    if (!session || !booking) return;
    const pct = booking.trip?.depart_at ? previewRefundPct(booking.trip.depart_at) : 0;
    const refundLine =
      pct > 0
        ? `You'll get back LKR ${(Math.round(booking.amount * pct) / 100).toLocaleString("en-LK")} (${pct}%, based on how close to departure this is).`
        : "This is inside the no-refund window, so no amount will be returned.";

    Alert.alert("Cancel this booking?", refundLine, [
      { text: "Keep booking", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelBooking(session.access_token, booking.id);
            const refreshed = await getBooking(session.access_token, booking.id);
            setBooking(refreshed);
          } catch (e) {
            Alert.alert("Couldn't cancel", e instanceof ApiError ? e.message : "Try again.");
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {hero}
      <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Text style={[styles.status, { color: confirmed ? "#16a34a" : "#c17a1f" }]}>
          {confirmed ? "Confirmed" : booking.status === "pending" ? "Payment pending…" : booking.status}
        </Text>

        {confirmed && ticket?.qr_signature ? (
          <View style={styles.qrWrap}>
            <QRCode value={ticket.qr_signature} size={220} />
          </View>
        ) : booking.status === "pending" ? (
          <View style={styles.qrWrap}>
            <ActivityIndicator color={theme.brand} />
            <Text style={{ color: theme.textSecondary, marginTop: 8 }}>Waiting for payment confirmation…</Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <Text style={{ color: theme.textSecondary }}>Seats</Text>
          <Text style={{ color: theme.text, fontWeight: "700" }}>{booking.seats.join(", ")}</Text>
        </View>
        {booking.trip?.depart_at && (
          <View style={styles.row}>
            <Text style={{ color: theme.textSecondary }}>Departs</Text>
            <Text style={{ color: theme.text, fontWeight: "600" }}>{formatDateTime(booking.trip.depart_at)}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={{ color: theme.textSecondary }}>Amount</Text>
          <Text style={{ color: theme.brand, fontWeight: "800" }}>
            LKR {Number(booking.amount).toLocaleString("en-LK")}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={{ color: theme.textSecondary }}>Reference</Text>
          <Text style={{ color: theme.text }}>{booking.id.slice(0, 8).toUpperCase()}</Text>
        </View>
      </View>

      {cancellable && (
        <Pressable onPress={onCancelPress} disabled={cancelling} style={styles.cancelButton}>
          {cancelling ? (
            <ActivityIndicator color="#dc2626" />
          ) : (
            <Text style={{ color: "#dc2626", fontWeight: "600" }}>Cancel booking</Text>
          )}
        </Pressable>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: Spacing.four },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: { alignSelf: "flex-start", marginBottom: Spacing.two },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  card: { borderWidth: 1, borderRadius: 16, padding: Spacing.four, gap: Spacing.two },
  status: { fontSize: 16, fontWeight: "800", textAlign: "center", marginBottom: Spacing.three },
  qrWrap: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing.four },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  cancelButton: { alignItems: "center", paddingVertical: Spacing.three, marginTop: Spacing.three },
});
