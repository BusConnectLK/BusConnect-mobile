/**
 * Custom Google Maps JSON style for Android (react-native-maps uses real
 * Google Maps there, so full color styling is available — unlike iOS's
 * default Apple Maps provider, which only exposes built-in variants).
 * Muted, low-saturation base so the brand-blue route/bus/pins are the only
 * strong color on the map, Uber-style.
 */
export const MUTED_ANDROID_MAP_STYLE: {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string>[];
}[] = [
  { elementType: "geometry", stylers: [{ color: "#f3f4f6" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7d8797" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f3f4f6" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#dde1e7" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e3e6ea" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#7d8797" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#eef1f5" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d9ee" }] },
];
