import { useEffect, useState } from "react";
import { Animated, Image, StyleSheet } from "react-native";

/**
 * Reuses the exact native splash screen's background color + mark (see
 * app.json's expo-splash-screen plugin config) as a brief overlay during
 * "hard reset" moments — sign out, account deletion — so they feel like a
 * deliberate fresh start rather than an abrupt content swap. Fades in
 * instead of popping in instantly, which otherwise reads as a jarring flash
 * cut rather than a deliberate transition.
 */
export function SplashTransition() {
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [opacity]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, { opacity }]}>
      <Image source={require("../../assets/images/applogo.png")} style={styles.mark} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#004AAD",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  mark: { width: 140, height: 140, borderRadius: 24 },
});
