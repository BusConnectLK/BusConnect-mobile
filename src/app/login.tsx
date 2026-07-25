import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { PhoneField } from "@/components/phone-field";
import { toE164 } from "@/lib/phone";
import { Spacing } from "@/constants/theme";

export default function LoginScreen() {
  const theme = useTheme();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goNext() {
    // `next` is a dynamic, runtime-constructed path (e.g. "/trips/abc?from=x")
    // that typed routes can't statically validate — Href is the documented
    // escape hatch for exactly this case.
    router.replace(((next as string) || "/") as Href);
  }

  async function signIn() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ phone: toE164(phone), password });
    setLoading(false);
    if (error) return setError(error.message);
    goNext();
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.badge, { backgroundColor: theme.brand }]}>
        <Ionicons name="bus" size={30} color="#fff" />
      </View>

      <Text style={[styles.title, { color: theme.text }]}>Welcome back</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Sign in with your phone number and password.</Text>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Phone number</Text>
        <PhoneField value={phone} onChangeText={setPhone} />

        <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.three }]}>Password</Text>
        <View style={[styles.inputWrap, { borderColor: theme.border }]}>
          <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            autoComplete="current-password"
            style={[styles.input, { color: theme.text }]}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          onPress={signIn}
          disabled={loading || !phone || !password}
          style={[styles.button, { backgroundColor: theme.brand, opacity: loading || !phone || !password ? 0.6 : 1 }]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: "/signup", params: { next: (next as string) || undefined } })}
          style={{ marginTop: Spacing.three, alignItems: "center" }}
        >
          <Text style={{ color: theme.textSecondary }}>
            New to BusConnect? <Text style={{ color: theme.brand, fontWeight: "700" }}>Sign up</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, paddingTop: Spacing.six, alignItems: "center" },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.three,
  },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.two,
    marginBottom: Spacing.five,
    lineHeight: 20,
    maxWidth: 300,
  },
  card: { width: "100%", borderWidth: 1, borderRadius: 20, padding: Spacing.four },
  fieldLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
  },
  input: { flex: 1, paddingVertical: Spacing.three, fontSize: 16 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: Spacing.four },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: "#dc2626", marginTop: Spacing.three, fontSize: 13 },
});
