import { Linking, Platform } from "react-native";

// TODO: replace with the real numeric App Store id once BusConnect is
// published (Apple only allocates one after the app is created in App Store
// Connect) — format is "id0000000000".
const IOS_APP_STORE_ID = "";
const ANDROID_PACKAGE = "lk.busconnect.app";

// TODO: replace with BusConnect's real WhatsApp Business support number,
// digits only with country code, no "+" (e.g. "94771234567").
const SUPPORT_WHATSAPP_NUMBER = "94000000000";

export async function openStoreReview(): Promise<void> {
  const url =
    Platform.OS === "ios" && IOS_APP_STORE_ID
      ? `itms-apps://apps.apple.com/app/${IOS_APP_STORE_ID}?action=write-review`
      : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  await Linking.openURL(url);
}

export async function openWhatsAppSupport(): Promise<void> {
  const message = encodeURIComponent("Hi, I need help with my BusConnect booking.");
  await Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${message}`);
}
