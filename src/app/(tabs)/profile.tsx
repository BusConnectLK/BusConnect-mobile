import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/use-theme";
import { useThemeMode } from "@/lib/theme-mode-context";
import { useAuth } from "@/lib/auth";
import { uploadPassengerPhoto } from "@/lib/storage";
import { getMyProfile, updateMyProfile, ApiError, type MyProfile } from "@/lib/api";
import { PhoneField } from "@/components/phone-field";
import { stripCountryCode, toE164 } from "@/lib/phone";
import { getPushNotificationsEnabled, setPushNotificationsEnabled } from "@/lib/notification-preference";
import { openStoreReview, openWhatsAppSupport } from "@/lib/app-links";
import { SplashTransition } from "@/components/splash-transition";
import { Spacing } from "@/constants/theme";

export default function ProfileScreen() {
  const theme = useTheme();
  const { session, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setTimeout(() => router.replace("/login"), 500);
  }

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
        <ProfileHero profile={profile} theme={theme} onPickPhoto={() => {}} />

        <ProfileForm
          profile={profile}
          accessToken={session.access_token}
          provider={session.user.app_metadata?.provider ?? null}
          userId={session.user.id}
          onSaved={setProfile}
          theme={theme}
        />

        <PreferencesSection theme={theme} />
        <SupportSection theme={theme} />

        <Pressable onPress={handleSignOut} style={[styles.rowCard, { borderColor: theme.border }]}>
          <Ionicons name="log-out-outline" size={17} color="#dc2626" />
          <Text style={{ color: "#dc2626", fontWeight: "600" }}>Sign out</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.four }]}>Danger zone</Text>
        <Pressable
          onPress={() => router.push("/delete-account")}
          style={[styles.rowCard, { borderColor: theme.border }]}
        >
          <Ionicons name="trash-outline" size={17} color="#dc2626" />
          <Text style={{ color: "#dc2626", fontWeight: "600" }}>Delete account</Text>
        </Pressable>
      </ScrollView>
      {signingOut && <SplashTransition />}
    </View>
  );
}

function ProfileHero({ profile, theme }: { profile: MyProfile; theme: ReturnType<typeof useTheme>; onPickPhoto: () => void }) {
  return (
    <SafeAreaView edges={["top"]} style={[styles.hero, { backgroundColor: theme.brand }]}>
      {profile.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Ionicons name="person" size={40} color="rgba(255,255,255,0.85)" />
        </View>
      )}
      <Text style={styles.heroName}>{profile.name || "Add your name"}</Text>
      <Text style={styles.heroSubtitle}>{profile.email || profile.phone || ""}</Text>
    </SafeAreaView>
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
  const [phone, setPhone] = useState(stripCountryCode(profile.phone));
  const [email, setEmail] = useState(profile.email ?? "");
  const [nic, setNic] = useState(profile.nic ?? "");
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
        phone: phoneLocked ? undefined : phone ? toE164(phone) : undefined,
        email: emailLocked ? undefined : email || undefined,
        nic: nic || undefined,
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
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.cardTitleRow}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Personal information</Text>
        <Pressable onPress={pickPhoto} hitSlop={8}>
          <Text style={{ color: theme.brand, fontWeight: "600", fontSize: 13 }}>
            {avatarSrc ? "Change photo" : "Add photo"}
          </Text>
        </Pressable>
      </View>

      <Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" theme={theme} />

      {!phoneLocked && (
        <View style={{ marginTop: Spacing.three }}>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Phone number</Text>
          <PhoneField value={phone} onChangeText={setPhone} />
        </View>
      )}

      <Field
        label="NIC"
        value={nic}
        onChangeText={setNic}
        placeholder="200012345678 or 991234567V"
        theme={theme}
      />

      {!emailLocked && (
        <Field
          label="Email address (optional)"
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
  );
}

function PreferencesSection({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const { mode, setMode } = useThemeMode();
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    void getPushNotificationsEnabled().then(setPushEnabled);
  }, []);

  async function togglePush(next: boolean) {
    setPushEnabled(next);
    await setPushNotificationsEnabled(next);
  }

  const modes: { key: "light" | "dark" | "system"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "light", label: "Light", icon: "sunny-outline" },
    { key: "dark", label: "Dark", icon: "moon-outline" },
    { key: "system", label: "System", icon: "phone-portrait-outline" },
  ];

  return (
    <View style={{ marginTop: Spacing.four }}>
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Preferences</Text>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: Spacing.two }]}>Appearance</Text>
        <View style={styles.segmentRow}>
          {modes.map((m) => {
            const active = mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[
                  styles.segment,
                  { borderColor: theme.border, backgroundColor: active ? theme.brand : "transparent" },
                ]}
              >
                <Ionicons name={m.icon} size={15} color={active ? "#fff" : theme.textSecondary} />
                <Text style={{ color: active ? "#fff" : theme.text, fontWeight: "600", fontSize: 13 }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>Push notifications</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Trip updates and alerts</Text>
          </View>
          <Switch value={pushEnabled} onValueChange={togglePush} trackColor={{ true: theme.brand }} />
        </View>
      </View>
    </View>
  );
}

function SupportSection({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ marginTop: Spacing.four }}>
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Support</Text>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border, gap: 0 }]}>
        <Pressable onPress={() => void openStoreReview()} style={styles.linkRow}>
          <Ionicons name="star-outline" size={18} color={theme.textSecondary} />
          <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15, flex: 1 }}>Rate us</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Pressable onPress={() => void openWhatsAppSupport()} style={styles.linkRow}>
          <Ionicons name="logo-whatsapp" size={18} color={theme.textSecondary} />
          <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15, flex: 1 }}>Help center</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
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
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: "rgba(255,255,255,0.6)" },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  heroName: { fontSize: 19, fontWeight: "800", color: "#fff", marginTop: Spacing.three },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  card: {
    marginHorizontal: Spacing.four,
    marginTop: -Spacing.four,
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.four,
  },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginHorizontal: Spacing.four + Spacing.one,
    marginBottom: Spacing.two,
  },
  fieldLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, fontSize: 16 },
  saveButton: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: Spacing.four },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  rowCard: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
  },
  segmentRow: { flexDirection: "row", gap: Spacing.two },
  segment: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.three },
  toggleRow: { flexDirection: "row", alignItems: "center" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.three },
});
