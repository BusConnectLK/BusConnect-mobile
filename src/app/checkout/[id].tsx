import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth";
import { checkoutBooking, ApiError, type MpgsCheckoutSession } from "@/lib/api";
import { Spacing } from "@/constants/theme";

/**
 * A minimal HTML shell that loads MPGS's hosted-checkout SDK and hands it
 * only the session id — the SDK then does a full-page redirect to MPGS's own
 * payment page inside this WebView. data-error/data-cancel are function
 * *names* the SDK looks up on window, not URLs; they only fire for a problem
 * before the page ever leaves (bad/expired session) — there is no
 * client-side success callback for this flow at all.
 */
function checkoutHtml(checkout: MpgsCheckoutSession) {
  return `<!doctype html><html><body>
    <script>
      window.mpgsErrorCallback = function (err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", err: String(err) }));
      };
      window.mpgsCancelCallback = function () {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "cancel" }));
      };
    </script>
    <script
      src="${checkout.checkoutJsUrl}"
      data-error="mpgsErrorCallback"
      data-cancel="mpgsCancelCallback"
    ></script>
    <script>
      (async function () {
        try {
          await window.Checkout.configure({ session: { id: "${checkout.sessionId}" } });
          await window.Checkout.showPaymentPage();
        } catch (err) {
          window.mpgsErrorCallback(err);
        }
      })();
    </script>
  </body></html>`;
}

export default function CheckoutScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [checkout, setCheckout] = useState<MpgsCheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !session) return;
    checkoutBooking(session.access_token, id)
      .then(setCheckout)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not start payment."));
  }, [id, session]);

  function onNavigate(nav: WebViewNavigation) {
    // MPGS's return_url resolves through our API to
    // `${webBaseUrl}/bookings/{id}?...` — once the WebView reaches that,
    // hand off to the native ticket screen instead of rendering the web page.
    if (id && nav.url.includes(`/bookings/${id}`)) {
      router.replace({ pathname: "/bookings/[id]", params: { id } });
    }
  }

  function onMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "error") {
        setError("Payment could not start. Please try again.");
      }
      // "cancel" is rare for this redirect mode; leave the WebView showing.
    } catch {
      // ignore malformed messages
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
          <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Redirecting to secure checkout…</Text>
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
        onMessage={onMessage}
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
