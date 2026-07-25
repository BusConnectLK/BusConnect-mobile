import { Image, StyleSheet, View } from "react-native";

/**
 * Reuses the exact native splash screen's background color + mark (see
 * app.json's expo-splash-screen plugin config) as a brief overlay during
 * "hard reset" moments — sign out, account deletion — so they feel like a
 * deliberate fresh start rather than an abrupt content swap.
 */
export function SplashTransition() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      <Image source={require("../../assets/images/splash-icon.png")} style={styles.mark} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#208AEF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  mark: { width: 76, height: 76 },
});
