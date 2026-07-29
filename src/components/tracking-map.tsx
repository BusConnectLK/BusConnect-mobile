import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import MapView, { AnimatedRegion, Marker, Polyline, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { TripRoute } from "@/lib/api";
import { MUTED_ANDROID_MAP_STYLE } from "@/constants/map-style";

export interface BusPosition {
  lat: number;
  lng: number;
}

const BRAND = "#004aad";
const ROUTE_UPCOMING = "#a9c2e8";

type LatLng = { latitude: number; longitude: number };

/** A region that frames a set of coordinates with some padding. */
function regionFor(coords: LatLng[]): Region {
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.04),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.04),
  };
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

/** Initial compass bearing from a to b, in degrees (0 = north). */
function bearingBetween(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Index of the route-coordinate vertex closest to a point (nearest-vertex
 *  approximation — good enough to split the line into traveled/upcoming
 *  without pulling in a full geometry library). */
function nearestVertexIndex(point: LatLng, coords: LatLng[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const dLat = coords[i].latitude - point.latitude;
    const dLng = coords[i].longitude - point.longitude;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/**
 * Premium native live map for the passenger tracking screen — Google Maps on
 * Android, Apple Maps on iOS (react-native-maps). Draws the route line, every
 * stop, the passenger's own boarding stop as a highlighted pin, and a
 * brand-blue bus puck that glides smoothly (AnimatedRegion) between GPS
 * updates and rotates to its heading. Camera follows the bus until the user
 * pans away, then a recenter button brings it back — Uber-style.
 */
export function TrackingMap({
  route,
  boardingStopId,
  position,
}: {
  route: TripRoute;
  boardingStopId: string;
  position: BusPosition | null;
}) {
  const mapRef = useRef<MapView>(null);
  const [userMoved, setUserMoved] = useState(false);
  const placed = useRef(false);
  const prevPos = useRef<LatLng | null>(null);

  // Lazy-init the animated coordinate (a `useRef(new …)` would read the ref
  // during render, which the compiler lint disallows).
  const [busCoord] = useState(
    () =>
      new AnimatedRegion({
        latitude: position?.lat ?? 7.3,
        longitude: position?.lng ?? 80.0,
        latitudeDelta: 0,
        longitudeDelta: 0,
      }),
  );
  const [heading] = useState(() => new Animated.Value(0));
  const headingRotate = heading.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] });

  const routeCoords = useMemo<LatLng[]>(
    () => (route.path?.coordinates ?? []).map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
    [route],
  );

  // The already-traveled portion of the line (muted) vs. what's ahead (brand
  // blue) — a nearest-vertex split against the bus's current position, same
  // idea as Uber's "road behind you fades" treatment.
  const [traveledCoords, upcomingCoords] = useMemo<[LatLng[], LatLng[]]>(() => {
    if (!position || routeCoords.length < 2) return [[], routeCoords];
    const idx = nearestVertexIndex({ latitude: position.lat, longitude: position.lng }, routeCoords);
    return [routeCoords.slice(0, idx + 1), routeCoords.slice(idx)];
  }, [position, routeCoords]);

  const boardingStop = route.stops.find((s) => s.route_stop_id === boardingStopId);
  const otherStops = route.stops.filter((s) => s.route_stop_id !== boardingStopId);

  const initialRegion = useMemo<Region>(() => {
    if (position) {
      return { latitude: position.lat, longitude: position.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    }
    const pts = routeCoords.length ? routeCoords : route.stops.map((s) => ({ latitude: s.lat, longitude: s.lng }));
    return pts.length ? regionFor(pts) : { latitude: 7.3, longitude: 80.0, latitudeDelta: 1, longitudeDelta: 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial only; later movement is imperative
  }, []);

  // Imperatively move the marker + camera on each new position — no React
  // state, so it stays out of the compiler's setState-in-effect rule. The
  // first fix snaps; later ones glide (AnimatedRegion.timing). `toValue` is
  // required by the RN Animated config type but ignored by region timing.
  useEffect(() => {
    if (!position) return;
    const next: LatLng = { latitude: position.lat, longitude: position.lng };
    if (!placed.current) {
      placed.current = true;
      busCoord.setValue({ ...next, latitudeDelta: 0, longitudeDelta: 0 });
    } else {
      busCoord
        .timing({ toValue: 0, ...next, latitudeDelta: 0, longitudeDelta: 0, duration: 1000, useNativeDriver: false })
        .start();

      // Skip the bearing update on a near-zero move — GPS jitter at a stop
      // would otherwise spin the icon back and forth for no reason.
      const prev = prevPos.current;
      if (prev) {
        const moved = (prev.latitude - next.latitude) ** 2 + (prev.longitude - next.longitude) ** 2;
        if (moved > 1e-10) {
          Animated.timing(heading, {
            toValue: bearingBetween(prev, next),
            duration: 900,
            useNativeDriver: true,
          }).start();
        }
      }
    }
    prevPos.current = next;
    if (!userMoved) {
      mapRef.current?.animateCamera({ center: next }, { duration: 800 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to a new position
  }, [position?.lat, position?.lng]);

  function recenter() {
    setUserMoved(false);
    if (position) {
      mapRef.current?.animateCamera(
        { center: { latitude: position.lat, longitude: position.lng }, zoom: 15 },
        { duration: 700 },
      );
    } else if (routeCoords.length) {
      mapRef.current?.animateToRegion(regionFor(routeCoords), 700);
    }
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onPanDrag={() => !userMoved && setUserMoved(true)}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        showsCompass={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
        customMapStyle={Platform.OS === "android" ? MUTED_ANDROID_MAP_STYLE : undefined}
      >
        {traveledCoords.length > 1 && (
          <Polyline coordinates={traveledCoords} strokeColor={ROUTE_UPCOMING} strokeWidth={4} lineCap="round" lineJoin="round" />
        )}
        {upcomingCoords.length > 1 && (
          <Polyline coordinates={upcomingCoords} strokeColor={BRAND} strokeWidth={5} lineCap="round" lineJoin="round" />
        )}

        {otherStops.map((s) => (
          <Marker
            key={s.route_stop_id}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.stopDot, (s.is_origin || s.is_dest) && styles.stopDotEndpoint]} />
          </Marker>
        ))}

        {boardingStop && (
          <Marker
            coordinate={{ latitude: boardingStop.lat, longitude: boardingStop.lng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
            title="Your stop"
            description={boardingStop.name}
          >
            <View style={styles.youPin}>
              <Ionicons name="person" size={12} color="#fff" />
            </View>
          </Marker>
        )}

        {position && (
          <Marker.Animated coordinate={busCoord as unknown as LatLng} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.busPuckRing}>
              <Animated.View style={[styles.busPuck, { transform: [{ rotate: headingRotate }] }]}>
                <Ionicons name="bus" size={16} color="#fff" style={styles.busPuckIcon} />
              </Animated.View>
            </View>
          </Marker.Animated>
        )}
      </MapView>

      {userMoved && (
        <Pressable style={styles.recenter} onPress={recenter} hitSlop={8}>
          <Ionicons name="locate" size={20} color={BRAND} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stopDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#fff", borderWidth: 2, borderColor: BRAND },
  stopDotEndpoint: { width: 13, height: 13, borderRadius: 7 },
  youPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BRAND,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  busPuckRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BRAND,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  // Rotates independently of the static ring/shadow above so the heading
  // arrow turns without visibly spinning the white border or drop shadow.
  busPuck: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  busPuckIcon: { marginLeft: 1 },
  recenter: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
