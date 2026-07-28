import { DarkTheme, DefaultTheme, ThemeProvider, Stack, router, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeModeProvider, useThemeMode } from "@/lib/theme-mode-context";
import { SplashTransition } from "@/components/splash-transition";
import { OfflineBanner } from "@/components/offline-banner";
import "@/lib/push-notifications";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <InnerLayout />
      </AuthProvider>
    </ThemeModeProvider>
  );
}

function InnerLayout() {
  const { resolvedScheme } = useThemeMode();
  const { loading, signingOut } = useAuth();

  // Keep the native splash up until the auth session has actually resolved,
  // instead of hiding it the instant JS mounts — otherwise there's a brief
  // gap (blank/spinner) between the native splash disappearing and real
  // content appearing, which reads as a second, wrong-looking splash.
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  // Tapping a push notification deep-links into whatever screen it's about
  // (a ticket, a live-tracking trip) instead of just opening to the home tab.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route as string | undefined;
      if (route) router.push(route as Href);
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={resolvedScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: "minimal" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="delete-account" options={{ headerShown: false }} />
        <Stack.Screen name="search-results" options={{ headerShown: false }} />
        <Stack.Screen name="trips/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="track/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="checkout/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="bookings/[id]" options={{ headerShown: false }} />
      </Stack>
      {signingOut && <SplashTransition />}
      <OfflineBanner />
    </ThemeProvider>
  );
}
