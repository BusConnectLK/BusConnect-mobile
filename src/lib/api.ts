/**
 * Typed client for the BusConnect NestJS API — passenger-relevant subset,
 * ported from BusConnect-web/src/lib/api.ts (same shapes/names on purpose,
 * to keep the two clients easy to reason about side by side). Public reads
 * (search, trip detail, seat map) need no token. Writes (holds, bookings)
 * require the caller to pass the Supabase access token.
 */
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, ...rest } = init;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── Types (mirror BusConnect-api response shapes) ───────────────────────────

export interface TripSearchResult {
  trip_id: string;
  route_id: string;
  route_name: string;
  from_stop_id: string;
  to_stop_id: string;
  boarding_at: string;
  drop_at: string;
  fare: number;
  depart_at: string;
  arrive_est: string | null;
  status: string;
  bus_reg_no: string;
  bus_amenities: string[];
  bus_images: string[];
  bus_type_name: string;
  bus_type_class: string;
  bus_type_seat_count: number;
  operator_id: string;
  operator_name: string;
  operator_logo_url: string | null;
  operator_rating: number;
  operator_reliability_score: number;
}

export interface CrewMember {
  name: string;
  photoUrl: string | null;
}

export interface TripCrew {
  driver: CrewMember | null;
  conductor: CrewMember | null;
}

export function getTripCrew(tripId: string) {
  return request<TripCrew>(`/trips/${tripId}/crew`);
}

/**
 * Seat layout convention stored in bus_types.layout_json — see
 * BusConnect-web/src/lib/seat-layout.ts's layoutToGrid() for the full
 * legacy-vs-freeform explanation this mirrors. seat_no is opaque text
 * throughout the booking system regardless of which format produced it.
 */
export interface SeatLayout {
  rows: number;
  cols: (string | null)[];
  labels?: string[];
  grid?: (string | null)[][];
}

/** Per-seat status beyond plain taken/free — held (pending checkout), booked
 *  (with the gender picked at selection time), or blocked (conductor marked
 *  it out-of-service/reserved). */
export interface SeatState {
  seat_no: string;
  status: "held" | "booked" | "blocked";
  gender: "male" | "female" | null;
}

export interface SeatMap {
  trip_id: string;
  layout: SeatLayout | null;
  taken: string[];
  seats: SeatState[];
}

export interface TripStopTime {
  route_stop_id: string;
  seq: number;
  location_id: string;
  location_name: string;
  scheduled_at: string | null;
  can_board: boolean;
  can_drop: boolean;
}

export interface TripFare {
  from_stop_id: string;
  to_stop_id: string;
  fare: number;
}

export interface TripDetail {
  id: string;
  depart_at: string;
  arrive_est: string | null;
  base_fare: number;
  status: string;
  route: { id: string; name: string; origin_id: string; dest_id: string };
  bus: {
    reg_no: string;
    amenities: string[];
    operator: { id: string; name: string; logo_url: string | null; rating: number; reliability_score: number } | null;
    bus_type: { name: string; class: string; seat_count: number; layout_json: SeatLayout | null };
  };
  fares: TripFare[];
  stops: TripStopTime[];
}

export interface Booking {
  id: string;
  trip_id: string;
  seats: string[];
  amount: number;
  status: string;
  from_stop_id: string;
  to_stop_id: string;
  tickets?: { id: string; status: string; qr_signature: string | null }[];
  payments?: { id: string; status: string; amount: number }[];
  refunds?: { id: string; amount: number; reason: string; status: string }[];
  trip?: { depart_at: string };
}

export interface CancelResult {
  ok: true;
  refundPct: number;
  refundAmount: number;
  refundStatus: "processed" | "pending_manual" | "not_eligible" | "none";
  message: string;
}

export interface HoldResult {
  ok: boolean;
  hold_group: string;
  trip_id: string;
  seats: string[];
  expires_at: string;
}

export interface BookingResult {
  ok: boolean;
  booking_id: string;
  trip_id: string;
  seats: string[];
  amount: number;
}

/** WebXPay hosted-checkout redirect: POST `fields` to `action`. */
export interface WebXPayCheckout {
  action: string;
  fields: Record<string, string>;
}

// ── Public (no token) ────────────────────────────────────────────────────────

export function searchTrips(params: { from: string; to: string; date: string }) {
  const qs = new URLSearchParams(params).toString();
  return request<TripSearchResult[]>(`/search?${qs}`);
}

export function getTrip(id: string) {
  return request<TripDetail>(`/trips/${id}`);
}

export function getSeatmap(id: string) {
  return request<SeatMap>(`/trips/${id}/seatmap`);
}

// ── Authenticated (token required) ──────────────────────────────────────────

export function createHold(
  accessToken: string,
  body: { tripId: string; seats: { seatNo: string; gender?: "male" | "female" }[] },
) {
  return request<HoldResult>("/holds", {
    method: "POST",
    body: JSON.stringify(body),
    accessToken,
  });
}

export function releaseHold(accessToken: string, holdGroup: string) {
  return request(`/holds/${holdGroup}`, { method: "DELETE", accessToken });
}

export function createBooking(
  accessToken: string,
  body: { holdGroup: string; fromStopId: string; toStopId: string },
) {
  return request<BookingResult>("/bookings", {
    method: "POST",
    body: JSON.stringify(body),
    accessToken,
  });
}

export function getBooking(accessToken: string, id: string) {
  return request<Booking>(`/bookings/${id}`, { accessToken });
}

export function cancelBooking(accessToken: string, id: string) {
  return request<CancelResult>(`/bookings/${id}/cancel`, {
    method: "POST",
    accessToken,
  });
}

export function checkoutBooking(accessToken: string, bookingId: string) {
  return request<WebXPayCheckout>(`/bookings/${bookingId}/pay`, {
    method: "POST",
    accessToken,
  });
}
