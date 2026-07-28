import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/** True/false once NetInfo reports a real state; null until the first
 *  event arrives (avoids a false "offline" flash on cold start). */
export function useNetworkStatus(): boolean | null {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected !== false && state.isInternetReachable !== false);
    });
  }, []);

  return isConnected;
}
