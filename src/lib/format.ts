/**
 * Modul format deterministik dengan locale Indonesia (id-ID) dan timeZone Asia/Jakarta
 */

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const decimalFormatter = (digits: number = 2) =>
  new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/**
 * Format angka bulat dengan pemisah titik (misal: 14782 -> "14.782")
 */
export function formatNumber(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return "0";
  return numberFormatter.format(Math.round(value));
}

/**
 * Format mata uang Rupiah dengan pemisah titik (misal: 14782 -> "Rp 14.782")
 */
export function formatRupiah(value: number, withPrefix: boolean = true): string {
  const formatted = formatNumber(value);
  return withPrefix ? `Rp ${formatted}` : formatted;
}

/**
 * Format persentase dengan pemisah koma desimal (misal: 5.25 -> "5,3%" atau "+5,3%")
 */
export function formatPersen(value: number, decimalDigits: number = 1, withSign: boolean = false): string {
  if (isNaN(value) || value === null || value === undefined) return "0%";
  const formatted = decimalFormatter(decimalDigits).format(value);
  if (withSign && value > 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Format tanggal string (YYYY-MM atau ISO) ke format tanggal Indonesia dengan zona waktu Jakarta
 */
export function formatTanggal(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return "";
  
  // Jika format YYYY-MM
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [year, month] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, 1));
    return new Intl.DateTimeFormat("id-ID", {
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
      ...options,
    }).format(dateObj);
  }

  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return dateStr;

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
    ...options,
  }).format(dateObj);
}

/**
 * Parsing teks bernomor dengan pemisah ribuan kembali ke integer
 */
export function parseFormattedNumber(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/[^\d]/g, "");
  return clean === "" ? 0 : parseInt(clean, 10);
}

