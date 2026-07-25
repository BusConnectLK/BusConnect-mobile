import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { deleteMyAccount, ApiError } from "@/lib/api";
import { SplashTransition } from "@/components/splash-transition";
import { Spacing } from "@/constants/theme";

/**
 * Deleting is really "deactivate + anonymize" server-side (see
 * BusConnect-api's DELETE /me/account) — booking/payment history survives,
 * only the passenger's own identifying fields are scrubbed and the account
 * is banned from signing back in.
 *
 * Re-verification before something this destructive: if the account has a
 * phone number on file, send a fresh OTP and require it (proves whoever's
 * holding the device right now can still receive it — protects against a
 * left-open session on a shared device). Accounts with no phone (Google
 * sign-in, never added one) fall back to typing a confirmation phrase.
 */
export default function DeleteAccountScreen() {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const phone = session?.user.phone;
  const [stage, setStage] = useState<"confirm" | "otp">("confirm");
  const [otp, setOtp] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  async function sendCode() {
    if (!phone) return;
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);
    if (error) return setError(error.message);
    setStage("otp");
  }

  async function finishWithOtp() {
    if (!phone) return;
    setError(null);
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    if (verifyError) {
      setLoading(false);
      return setError(verifyError.message);
    }
    await finishDelete();
  }

  async function finishWithConfirmText() {
    setError(null);
    setLoading(true);
    await finishDelete();
  }

  async function finishDelete() {
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Session expired — sign in again to delete your account.");
      await deleteMyAccount(accessToken);
      await signOut();
      setDeleted(true);
      setTimeout(() => router.replace("/login"), 500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function confirmAndDelete() {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your name, email, phone and NIC from BusConnect, and you won't be able to sign in again. Your booking and payment history is kept for records.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => (phone ? void sendCode() : void finishWithConfirmText()),
        },
      ],
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.badge, { backgroundColor: "#fee2e2" }]}>
        <Ionicons name="trash-outline" size={26} color="#dc2626" />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Delete account</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        This will permanently remove your personal details. Booking and payment history is kept for records and
        can&apos;t be recovered afterwards.
      </Text>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {stage === "confirm" ? (
          <>
            {!phone && (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Type DELETE to confirm
                </Text>
                <TextInput
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder="DELETE"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              onPress={confirmAndDelete}
              disabled={loading || (!phone && confirmText.trim().toUpperCase() !== "DELETE")}
              style={[
                styles.button,
                {
                  backgroundColor: "#dc2626",
                  opacity: loading || (!phone && confirmText.trim().toUpperCase() !== "DELETE") ? 0.6 : 1,
                },
              ]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Delete my account</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Enter the code sent to {phone}</Text>
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
              onPress={finishWithOtp}
              disabled={loading || !otp}
              style={[styles.button, { backgroundColor: "#dc2626", opacity: loading || !otp ? 0.6 : 1 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & delete</Text>}
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.back()} style={{ marginTop: Spacing.three, alignItems: "center" }}>
          <Text style={{ color: theme.textSecondary }}>Cancel</Text>
        </Pressable>
      </View>
      {deleted && <SplashTransition />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, paddingTop: Spacing.five, alignItems: "center" },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: Spacing.three },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", marginTop: Spacing.two, marginBottom: Spacing.five, lineHeight: 20, maxWidth: 320 },
  card: { width: "100%", borderWidth: 1, borderRadius: 20, padding: Spacing.four },
  fieldLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, fontSize: 16, marginBottom: Spacing.three },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: "#dc2626", marginBottom: Spacing.three, fontSize: 13 },
});
