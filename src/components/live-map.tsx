import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { getTripLive, type TripLive } from "@/lib/api";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

const POLL_MS = 15_000;

/** Static HTML shell: Leaflet (via CDN — simplest way to get a real map
 * inside a WebView without bundling map tiles/assets natively) with a
 * single marker, plus a global `updateMarker(lat, lng)` the RN side calls
 * via injectJavaScript on each poll so the map pans smoothly instead of
 * reloading the whole WebView every 15s. */
function mapHtml(lat: number, lng: number) {
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html,body,#map{height:100%;margin:0;padding:0;}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    var marker = L.circleMarker([${lat}, ${lng}], {
      radius: 9, color: '#ffffff', weight: 2, fillColor: '#004aad', fillOpacity: 1
    }).addTo(map);
    window.updateMarker = function(lat, lng) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng]);
    };
  </script>
</body>
</html>`;
}

export function LiveMap({ tripId, stopId, active }: { tripId: string; stopId: string; active: boolean }) {
  const theme = useTheme();
  const [live, setLive] = useState<TripLive | null>(null);
  const webviewRef = useRef<WebView>(null);
  const mapInitialized = useRef(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function poll() {
      try {
        const data = await getTripLive(tripId, stopId);
        if (cancelled) return;
        setLive(data);
        if (data.tracking && mapInitialized.current) {
          webviewRef.current?.injectJavaScript(`window.updateMarker(${data.lat}, ${data.lng}); true;`);
        }
      } catch {
        /* transient network error — just try again next tick */
      }
    }

    void poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tripId, stopId, active]);

  if (!active) return null;

  if (!live?.tracking) {
    return (
      <View style={[styles.placeholder, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          Live tracking will appear here once the driver starts the trip.
        </Text>
      </View>
    );
  }

  mapInitialized.current = true;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <WebView
        ref={webviewRef}
        style={styles.map}
        source={{ html: mapHtml(live.lat, live.lng) }}
        scrollEnabled={false}
      />
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <View style={styles.liveDot}>
          <View style={styles.dot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
        {live.eta_minutes != null ? (
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            <Text style={{ color: theme.text, fontWeight: "800" }}>{live.eta_minutes}</Text> min to your stop
          </Text>
        ) : live.speed_kmh != null ? (
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{Math.round(live.speed_kmh)} km/h</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: Spacing.three,
  },
  map: { height: 180, width: "100%" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
  },
  liveDot: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" },
  liveText: { color: "#16a34a", fontWeight: "700", fontSize: 13 },
});
