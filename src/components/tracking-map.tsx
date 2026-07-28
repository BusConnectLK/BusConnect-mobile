import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { AnimatedRegion, Marker, Polyline, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { TripRoute } from "@/lib/api";

export interface BusPosition {
  lat: number;
  lng: number;
}

const BRAND = "#004aad";

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

  const routeCoords = useMemo<LatLng[]>(
    () => (route.path?.coordinates ?? []).map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
    [route],
  );

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
    if (!placed.current) {
      placed.current = true;
      busCoord.setValue({ latitude: position.lat, longitude: position.lng, latitudeDelta: 0, longitudeDelta: 0 });
    } else {
      busCoord
        .timing({
          toValue: 0,
          latitude: position.lat,
          longitude: position.lng,
          latitudeDelta: 0,
          longitudeDelta: 0,
          duration: 1000,
          useNativeDriver: false,
        })
        .start();
    }
    if (!userMoved) {
      mapRef.current?.animateCamera({ center: { latitude: position.lat, longitude: position.lng } }, { duration: 800 });
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
      >
        {routeCoords.length > 1 && (
          <Polyline coordinates={routeCoords} strokeColor={BRAND} strokeWidth={5} lineCap="round" lineJoin="round" />
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
            <View style={styles.busPuck}>
              <Ionicons name="bus" size={15} color="#fff" />
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
  busPuck: {
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
