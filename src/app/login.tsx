import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, router, type Href } from "expo-router";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { Spacing } from "@/constants/theme";

GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  // Also required (not just the iOS client) — this is the audience Supabase
  // actually validates the returned ID token against, matching the web
  // app's own Google client. See BusConnect-web's login page for the
  // equivalent GSI-based flow.
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

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

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices(); // no-op on iOS, required before signIn() on Android
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // user cancelled — not an error
      const idToken = response.data.idToken;
      if (!idToken) {
        setError("Google didn't return a usable sign-in token. Try again.");
        return;
      }
      const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
      if (error) return setError(error.message);
      goNext();
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return;
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
