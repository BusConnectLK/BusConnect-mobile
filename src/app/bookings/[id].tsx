import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth";
import { getBooking, ApiError, type Booking } from "@/lib/api";
import { Spacing } from "@/constants/theme";

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

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>{error}</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  const ticket = booking.tickets?.[0];
  const confirmed = booking.status === "confirmed";

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: Spacing.four },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 16, padding: Spacing.four, gap: Spacing.two },
  status: { fontSize: 16, fontWeight: "800", textAlign: "center", marginBottom: Spacing.three },
  qrWrap: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing.four },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
});
