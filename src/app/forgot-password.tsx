import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { PhoneField } from "@/components/phone-field";
import { toE164 } from "@/lib/phone";
import { Spacing } from "@/constants/theme";

/**
 * Verifying the OTP itself completes sign-in (Supabase treats a correct
 * phone OTP as a full authentication, same as it does during sign-up) —
 * so by the time the user reaches the "new password" stage they already
 * have a live session, and updateUser({ password }) just sets it on that
 * session. No separate "reset token" concept needed.
 */
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"phone" | "otp" | "password">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
    setLoading(false);
    if (error) return setError(error.message);
    setStage("otp");
  }

  async function verifyCode() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: otp, type: "sms" });
    setLoading(false);
    if (error) return setError(error.message);
    setStage("password");
  }

  async function setNewPassword() {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    router.replace("/");
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.badge, { backgroundColor: theme.brand }]}>
        <Ionicons name="key-outline" size={28} color="#fff" />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Reset your password</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        {stage === "phone" && "Enter your phone number and we'll send you a code."}
        {stage === "otp" && `Enter the code sent to ${toE164(phone)}.`}
        {stage === "password" && "Choose a new password for your account."}
      </Text>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {stage === "phone" && (
          <>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Phone number</Text>
            <PhoneField value={phone} onChangeText={setPhone} />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              onPress={sendCode}
              disabled={loading || !phone}
              style={[styles.button, { backgroundColor: theme.brand, opacity: loading || !phone ? 0.6 : 1 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
            </Pressable>
          </>
        )}

        {stage === "otp" && (
          <>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>One-time code</Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              placeholder="6-digit code"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              style={[styles.input, { color: theme.text, borderColor: theme.border, letterSpacing: 6 }]}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              onPress={verifyCode}
              disabled={loading || !otp}
              style={[styles.button, { backgroundColor: theme.brand, opacity: loading || !otp ? 0.6 : 1 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify code</Text>}
            </Pressable>
          </>
        )}

        {stage === "password" && (
          <>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>New password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoComplete="new-password"
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              onPress={setNewPassword}
              disabled={loading || !password}
              style={[styles.button, { backgroundColor: theme.brand, opacity: loading || !password ? 0.6 : 1 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save new password</Text>}
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.back()} style={{ marginTop: Spacing.three, alignItems: "center" }}>
          <Text style={{ color: theme.textSecondary }}>Cancel</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, paddingTop: Spacing.six, alignItems: "center" },
  badge: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: Spacing.three },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", marginTop: Spacing.two, marginBottom: Spacing.five, lineHeight: 20, maxWidth: 300 },
  card: { width: "100%", borderWidth: 1, borderRadius: 20, padding: Spacing.four },
  fieldLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, fontSize: 16 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: Spacing.four },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: "#dc2626", marginTop: Spacing.three, fontSize: 13 },
});
