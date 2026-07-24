import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
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
    router.replace((next as string) ?? "/");
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
});
