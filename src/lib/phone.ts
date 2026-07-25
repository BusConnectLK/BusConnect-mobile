/** Sri Lanka country code, fixed across every phone input in the app. */
export const PHONE_COUNTRY_CODE = "+94";

/** Strips a leading "+94"/"94"/"0" so an existing stored number (e.g.
 *  "+94771234567") can populate a "local digits only" input that already
 *  shows the +94 prefix as a fixed badge. */
export function stripCountryCode(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("94")) return digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** Combines the fixed +94 prefix with whatever local digits the user typed. */
export function toE164(localDigits: string): string {
  return `${PHONE_COUNTRY_CODE}${localDigits.replace(/\D/g, "")}`;
}

/** Formats a stored phone number for display with a leading "+" — Supabase
 *  stores it as E.164 digits only (no "+"), so a raw display would silently
 *  drop the country-code prefix. */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.startsWith("+") ? phone : `+${phone}`;
}
