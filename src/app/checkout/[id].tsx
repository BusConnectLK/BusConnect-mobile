import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth";
import { checkoutBooking, ApiError, type WebXPayCheckout } from "@/lib/api";
import { Spacing } from "@/constants/theme";

/** A minimal HTML page that auto-submits WebXPay's hosted-checkout form —
 * mirrors exactly what BusConnect-web's pay-button.tsx does with a real DOM
 * form, since WebXPay only accepts a browser POST, not a direct API call. */
function checkoutHtml(checkout: WebXPayCheckout) {
  const inputs = Object.entries(checkout.fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeAttr(name)}" value="${escapeAttr(value)}" />`)
    .join("");
  return `<!doctype html><html><body onload="document.forms[0].submit()">
    <form method="POST" action="${escapeAttr(checkout.action)}">${inputs}</form>
  </body></html>`;
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export default function CheckoutScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [checkout, setCheckout] = useState<WebXPayCheckout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !session) return;
    checkoutBooking(session.access_token, id)
      .then(setCheckout)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not start payment."));
  }, [id, session]);

  function onNavigate(nav: WebViewNavigation) {
    // WebXPay's return_url resolves through our API to
    // `${webBaseUrl}/bookings/{id}?...` — once the WebView reaches that,
    // hand off to the native ticket screen instead of rendering the web page.
    if (id && nav.url.includes(`/bookings/${id}`)) {
      router.replace({ pathname: "/bookings/[id]", params: { id } });
    }
  }

  const hero = (
    <SafeAreaView edges={["top"]} style={[styles.hero, { backgroundColor: theme.brand }]}>
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>
      <Text style={styles.heroTitle}>Payment</Text>
      <View style={{ width: 22 }} />
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

  if (!checkout) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {hero}
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} />
          <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Redirecting to WebXPay…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {hero}
      <WebView
        style={{ flex: 1 }}
        source={{ html: checkoutHtml(checkout) }}
        onNavigationStateChange={onNavigate}
        onShouldStartLoadWithRequest={(req) => {
          if (id && req.url.includes(`/bookings/${id}`)) {
            router.replace({ pathname: "/bookings/[id]", params: { id } });
            return false;
          }
          return true;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  heroTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
