import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, router, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { Spacing } from "@/constants/theme";

export default function LoginScreen() {
  const theme = useTheme();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);
    if (error) return setError(error.message);
    setStage("otp");
  }

  async function verifyOtp() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    setLoading(false);
    if (error) return setError(error.message);
    goNext();
  }

  function goNext() {
    // `next` is a dynamic, runtime-constructed path (e.g. "/trips/abc?from=x")
    // that typed routes can't statically validate — Href is the documented
    // escape hatch for exactly this case.
    router.replace(((next as string) || "/") as Href);
  }

  /**
   * Browser-based OAuth (Supabase's own documented pattern), not the native
   * @react-native-google-signin SDK. That library generates its own internal
   * nonce for the ID token with no way for the app to supply — or even read
   * back — the pre-hash value, and Supabase requires the raw nonce (it
   * hashes it server-side to compare against the token's claim), so the two
   * are fundamentally incompatible. Routing through Supabase's own OAuth
   * redirect sidesteps ID-token/nonce handling entirely: Supabase talks to
   * Google directly and hands back a session once the browser redirects
   * home, the same trust model the web app's cookie session already uses.
   */
  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      const redirectTo = Linking.createURL("/login");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return setError(error.message);

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") return; // user cancelled/dismissed — not an error

      const url = new URL(result.url);
      const fragment = url.hash.startsWith("#") ? url.hash.slice(1) : url.search.slice(1);
      const params = new URLSearchParams(fragment);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) {
        setError("Google sign-in didn't return a valid session. Try again.");
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessionError) return setError(sessionError.message);
      goNext();
    } catch (e) {
      console.error("Google sign-in error:", e);
      setError("Could not sign in with Google. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Sign in</Text>
      <Text style={{ color: theme.textSecondary, marginBottom: Spacing.four }}>
        Enter your phone number to get a one-time code.
      </Text>

      {stage === "phone" ? (
        <>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+94 7X XXX XXXX"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
            autoComplete="tel"
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={requestOtp}
            disabled={loading || !phone}
            style={[styles.button, { backgroundColor: theme.brand, opacity: loading || !phone ? 0.6 : 1 }]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={{ color: theme.textSecondary, marginBottom: Spacing.two }}>Code sent to {phone}</Text>
          <TextInput
            value={otp}
            onChangeText={setOtp}
            placeholder="One-time code"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            style={[styles.input, { color: theme.text, borderColor: theme.border, letterSpacing: 6 }]}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={verifyOtp}
            disabled={loading || !otp}
            style={[styles.button, { backgroundColor: theme.brand, opacity: loading || !otp ? 0.6 : 1 }]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & sign in</Text>}
          </Pressable>
          <Pressable onPress={() => setStage("phone")} style={{ marginTop: Spacing.three, alignItems: "center" }}>
            <Text style={{ color: theme.textSecondary, textDecorationLine: "underline" }}>Use a different number</Text>
          </Pressable>
        </>
      )}

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>or</Text>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      </View>

      <Pressable
        onPress={signInWithGoogle}
        disabled={loading}
        style={[styles.googleButton, { borderColor: theme.border, opacity: loading ? 0.6 : 1 }]}
      >
        <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, paddingTop: Spacing.six },
  title: { fontSize: 26, fontWeight: "800", marginBottom: Spacing.two },
  input: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, fontSize: 16, marginBottom: Spacing.three },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: "#dc2626", marginBottom: Spacing.three },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two, marginVertical: Spacing.four },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  googleButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
});
