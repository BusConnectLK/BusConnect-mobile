import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth";
import { topupWallet, ApiError, type MpgsCheckoutSession } from "@/lib/api";
import { Spacing } from "@/constants/theme";

/** Same MPGS Hosted Checkout shell as the booking checkout screen — see
 *  checkout/[id].tsx for why the callbacks are function *names*, not URLs. */
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

export default function WalletTopupScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { amount } = useLocalSearchParams<{ amount: string }>();
  const [checkout, setCheckout] = useState<MpgsCheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const value = Number(amount);
    if (!value || !session) return;
    topupWallet(session.access_token, value)
      .then(setCheckout)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Could not start top-up."),
      );
  }, [amount, session]);

  // MPGS's return_url resolves through our API to `${webBaseUrl}/wallet?...`
  // — once the WebView reaches that, hand off to the native wallet screen.
  function backToWallet() {
    router.replace("/wallet");
  }

  function onNavigate(nav: WebViewNavigation) {
    if (nav.url.includes("/wallet")) backToWallet();
  }

  function onMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "error") {
        setError("Payment could not start. Please try again.");
      }
    } catch {
      // ignore malformed messages
    }
  }

  const hero = (
    <SafeAreaView
      edges={["top"]}
      style={[styles.hero, { backgroundColor: theme.brand }]}
    >
      <View style={styles.heroTopRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.heroTitle}>Top up wallet</Text>
        <View style={styles.backButton} />
      </View>
      {amount ? (
        <Text style={styles.heroSubtitle}>
          LKR {Number(amount).toLocaleString("en-LK")}
        </Text>
      ) : null}
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
          <Text style={{ color: theme.textSecondary, marginTop: 12 }}>
            Redirecting to secure checkout…
          </Text>
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
          if (req.url.includes("/wallet")) {
            backToWallet();
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
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  backButton: { width: 32 },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: Spacing.one,
  },
});
