import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth";
import { uploadPassengerPhoto } from "@/lib/storage";
import { getMyProfile, updateMyProfile, ApiError, type MyProfile } from "@/lib/api";
import { Spacing } from "@/constants/theme";

export default function ProfileScreen() {
  const theme = useTheme();
  const { session, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    getMyProfile(session.access_token)
      .then(setProfile)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Could not reach BusConnect-api."));
  }, [session]);

  if (authLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Pressable onPress={() => router.push({ pathname: "/login", params: { next: "/profile" } })}>
          <Text style={{ color: theme.brand, fontWeight: "600", fontSize: 16 }}>Sign in to view your profile</Text>
        </Pressable>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: "#dc2626" }}>{loadError}</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ProfileForm
          profile={profile}
          accessToken={session.access_token}
          provider={session.user.app_metadata?.provider ?? null}
          userId={session.user.id}
          onSaved={setProfile}
          theme={theme}
        />

        <Pressable
          onPress={() => {
            void signOut();
            router.replace("/");
          }}
          style={[styles.signOutButton, { borderColor: theme.border }]}
        >
          <Ionicons name="log-out-outline" size={17} color="#dc2626" />
          <Text style={{ color: "#dc2626", fontWeight: "600" }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ProfileForm({
  profile,
  accessToken,
  provider,
  userId,
  onSaved,
  theme,
}: {
  profile: MyProfile;
  accessToken: string;
  provider: string | null;
  userId: string;
  onSaved: (p: MyProfile) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const [name, setName] = useState(profile.name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Google owns the email on a Google sign-in; the phone number is the login
  // credential itself on phone-OTP sign-in — neither is safe to edit here.
  const emailLocked = provider === "google";
  const phoneLocked = provider === "phone";

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to change your profile photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  async function submit() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      let avatarUrl: string | undefined;
      if (photoUri) {
        setStatus("Uploading photo…");
        avatarUrl = await uploadPassengerPhoto(userId, photoUri);
      }

      setStatus("Saving…");
      const updated = await updateMyProfile(accessToken, {
        name: name || undefined,
        phone: phoneLocked ? undefined : phone || undefined,
        email: emailLocked ? undefined : email || undefined,
        avatarUrl,
      });
      onSaved(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save changes.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  const avatarSrc = photoUri ?? profile.avatar_url;

  return (
    <>
      <SafeAreaView edges={["top"]} style={[styles.hero, { backgroundColor: theme.brand }]}>
        <Pressable onPress={pickPhoto} style={styles.avatarWrap}>
          {avatarSrc ? (
            <Image source={{ uri: avatarSrc }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={40} color="rgba(255,255,255,0.85)" />
            </View>
          )}
          <View style={[styles.avatarEditBadge, { backgroundColor: theme.backgroundElement, borderColor: theme.brand }]}>
            <Ionicons name="camera" size={14} color={theme.brand} />
          </View>
        </Pressable>
        <Text style={styles.heroName}>{profile.name || "Add your name"}</Text>
        <Text style={styles.heroSubtitle}>{profile.email || profile.phone || ""}</Text>
      </SafeAreaView>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Personal details</Text>

        <Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" theme={theme} />

        {!phoneLocked && (
          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+94 7X XXX XXXX"
            keyboardType="phone-pad"
            theme={theme}
          />
        )}

        {!emailLocked && (
          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.lk"
            keyboardType="email-address"
            theme={theme}
          />
        )}

        {error && <Text style={{ color: "#dc2626", marginTop: Spacing.two }}>{error}</Text>}
        {saved && !error && <Text style={{ color: "#059669", marginTop: Spacing.two }}>Saved.</Text>}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={[styles.saveButton, { backgroundColor: theme.brand, opacity: busy ? 0.6 : 1 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{status ?? "Save changes"}</Text>}
        </Pressable>
      </View>
    </>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: "phone-pad" | "email-address";
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ marginTop: Spacing.three }}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingBottom: Spacing.six },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    alignItems: "center",
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarWrap: { marginBottom: Spacing.three },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: "rgba(255,255,255,0.6)" },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: { fontSize: 19, fontWeight: "800", color: "#fff" },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  card: {
    marginHorizontal: Spacing.four,
    marginTop: -Spacing.four,
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.four,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: Spacing.two },
  fieldLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, fontSize: 16 },
  saveButton: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: Spacing.four },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  signOutButton: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
  },
});
