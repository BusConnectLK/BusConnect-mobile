import * as SecureStore from "expo-secure-store";

/**
 * Local device preference only — there's no push-notification infrastructure
 * (Expo push token registration, a backend device-token table, or anything
 * that actually sends one) wired up yet. This just remembers what the user
 * chose so the real thing can read it once it exists.
 */
const KEY = "busconnect-push-notifications-enabled";

export async function getPushNotificationsEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(KEY);
  return value !== "false"; // default on
}

export async function setPushNotificationsEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY, enabled ? "true" : "false");
}
