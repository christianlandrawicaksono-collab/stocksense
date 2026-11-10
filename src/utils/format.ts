/**
 * Pure deterministic number formatting to prevent SSR/hydration mismatch
 * Always uses '.' as thousand separator (Indonesian format)
 */
export function formatNumber(val: number): string {
  if (isNaN(val) || val === null || val === undefined) return "0";
  const isNegative = val < 0;
  const absVal = Math.abs(Math.round(val));
  const str = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return isNegative ? `-${str}` : str;
}

export function formatIDR(val: number): string {
  return `Rp ${formatNumber(val)}`;
}

export function parseFormattedNumber(str: string): number {
  const clean = str.replace(/[^\d]/g, "");
  return clean === "" ? 0 : parseInt(clean, 10);
}
