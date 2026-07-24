import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth";
import { checkoutBooking, ApiError, type WebXPayCheckout } from "@/lib/api";

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

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>{error}</Text>
      </View>
    );
  }

  if (!checkout) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.brand} />
        <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Redirecting to WebXPay…</Text>
      </View>
    );
  }

  return (
    <WebView
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
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
