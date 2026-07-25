import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth";
import { ThemeModeProvider, useThemeMode } from "@/lib/theme-mode-context";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeModeProvider>
      <InnerLayout />
    </ThemeModeProvider>
  );
}

function InnerLayout() {
  const { resolvedScheme } = useThemeMode();

  return (
    <ThemeProvider value={resolvedScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" options={{ headerShown: true, title: "Sign in" }} />
          <Stack.Screen name="signup" options={{ headerShown: true, title: "Sign up" }} />
          <Stack.Screen name="delete-account" options={{ headerShown: true, title: "Delete account" }} />
          <Stack.Screen name="search-results" options={{ headerShown: true, title: "Search results" }} />
          <Stack.Screen name="trips/[id]" options={{ headerShown: true, title: "Trip details" }} />
          <Stack.Screen name="checkout/[id]" options={{ headerShown: true, title: "Payment" }} />
          <Stack.Screen name="bookings/[id]" options={{ headerShown: true, title: "Your ticket" }} />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
