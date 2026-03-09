/**
 * Formats a numeric string with comma separators for Korean currency display.
 * Input: raw digit string (e.g., "15000")
 * Output: comma-formatted string (e.g., "15,000")
 */
export function formatWithCommas(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

/**
 * Strips commas from a formatted currency string to get raw digits.
 * Input: "15,000"
 * Output: "15000"
 */
export function stripCommas(value: string): string {
  return value.replace(/,/g, "");
}
