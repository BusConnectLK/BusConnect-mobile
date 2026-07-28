import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { registerPushToken, unregisterPushToken } from "./api";

// Foreground display config — module scope so it applies app-wide, not just
// on whichever screen happens to be mounted when a push arrives.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getExpoPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

/** Best-effort — a denied permission or a push-token fetch failure (e.g. on
 *  a simulator) must never block sign-in. */
export async function registerForPushNotifications(accessToken: string): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "General",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") return;

    const token = await getExpoPushToken();
    if (!token) return;

    await registerPushToken(accessToken, {
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
      app: "passenger",
    });
  } catch {
    /* best-effort */
  }
}

/** Best-effort cleanup on sign-out — call before the session is cleared,
 *  since this needs a valid access token to authenticate the request.
 *  Leaving a stale token around just means one fewer push reaches a
 *  signed-out device, not a functional problem. */
export async function unregisterCurrentPushToken(accessToken: string): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (!token) return;
    await unregisterPushToken(accessToken, token);
  } catch {
    /* best-effort */
  }
}
