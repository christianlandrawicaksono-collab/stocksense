/**
 * Modul format deterministik dengan locale Indonesia (id-ID) dan timeZone Asia/Jakarta
 * Semua desimal menggunakan pemisah koma (,) dan ribuan menggunakan titik (.)
 */

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const decimalFormatter = (digits: number = 1) =>
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
 * Format desimal dengan pemisah koma (misal: 14.5 -> "14,5", 0.92 -> "0,92")
 */
export function formatDesimal(value: number, digits: number = 1, withSign: boolean = false): string {
  if (isNaN(value) || value === null || value === undefined) return "0";
  const formatted = decimalFormatter(digits).format(value);
  if (withSign && value > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

/**
 * Format rasio / multiple valuasi (misal: 0.92 -> "0,92x", 23.4 -> "23,4x")
 */
export function formatMultiple(value: number, digits: number = 1): string {
  if (isNaN(value) || value === null || value === undefined) return "0x";
  return `${formatDesimal(value, digits)}x`;
}

/**
 * Format persentase dengan pemisah koma desimal (misal: 14.5 -> "14,5%" atau "+13,2%")
 */
export function formatPersen(value: number, digits: number = 1, withSign: boolean = false): string {
  if (isNaN(value) || value === null || value === undefined) return "0%";
  const formatted = decimalFormatter(digits).format(value);
  if (withSign && value > 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Format mata uang Rupiah dengan pemisah titik (misal: 14782 -> "Rp 14.782")
 */
export function formatRupiah(value: number, withPrefix: boolean = true): string {
  const formatted = formatNumber(value);
  return withPrefix ? `Rp ${formatted}` : formatted;
}

/**
 * Format tanggal YYYY-MM ke nama bulan dan tahun singkat (misal: "2021-03" -> "Mar 2021")
 */
export function formatTanggalBulanTahun(dateStr: string): string {
  if (!dateStr) return "";
  const match = dateStr.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const months = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
    ];
    const monthName = months[month - 1] || "";
    return `${monthName} ${year}`;
  }
  return dateStr;
}

/**
 * Format tanggal string (YYYY-MM atau ISO) ke format tanggal Indonesia panjang
 */
export function formatTanggal(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return "";
  
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return formatTanggalBulanTahun(dateStr);
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
 * Parsing teks angka berpemisah ribuan kembali ke integer
 */
export function parseFormattedNumber(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/[^\d]/g, "");
  return clean === "" ? 0 : parseInt(clean, 10);
}

/**
 * Menghitung Internal Rate of Return (IRR) kuartalan dan di-annualized
 * untuk arus kas setoran bertahap (DCA).
 * Menggunakan metode Newton-Raphson dengan fallback ke Bisection.
 * @param cashFlows Arus kas per kuartal (setoran negatif, nilai akhir positif)
 * @returns Annualized IRR dalam persen (misal 12.5 untuk 12,5%) atau null jika tidak konvergen
 */
export function calculateAnnualizedIRR(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;

  // Pastikan ada arus kas negatif dan positif
  const hasNegative = cashFlows.some((cf) => cf < 0);
  const hasPositive = cashFlows.some((cf) => cf > 0);
  if (!hasNegative || !hasPositive) return null;

  const npv = (r: number): number => {
    let sum = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      sum += cashFlows[t] / Math.pow(1 + r, t);
    }
    return sum;
  };

  const derivativeNpv = (r: number): number => {
    let sum = 0;
    for (let t = 1; t < cashFlows.length; t++) {
      sum += (-t * cashFlows[t]) / Math.pow(1 + r, t + 1);
    }
    return sum;
  };

  // 1. Coba Newton-Raphson
  let r = 0.03; // Inisialisasi 3% per kuartal (~12% per tahun)
  const maxIterations = 50;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    const fVal = npv(r);
    const fPrime = derivativeNpv(r);
    if (Math.abs(fPrime) < 1e-10) break;
    const nextR = r - fVal / fPrime;
    if (Math.abs(nextR - r) < tolerance) {
      if (nextR > -0.99 && nextR < 5.0) {
        const annualized = (Math.pow(1 + nextR, 4) - 1) * 100;
        return isFinite(annualized) ? annualized : null;
      }
      break;
    }
    r = nextR;
  }

  // 2. Fallback Bisection jika Newton gagal
  let low = -0.5; // -50% per kuartal
  let high = 1.0; // +100% per kuartal
  let npvLow = npv(low);
  let npvHigh = npv(high);

  if (npvLow * npvHigh > 0) {
    // Luaskan rentang
    high = 3.0;
    npvHigh = npv(high);
    if (npvLow * npvHigh > 0) return null;
  }

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);
    if (Math.abs(npvMid) < tolerance || (high - low) / 2 < tolerance) {
      const annualized = (Math.pow(1 + mid, 4) - 1) * 100;
      return isFinite(annualized) ? annualized : null;
    }
    if (npvMid * npvLow > 0) {
      low = mid;
      npvLow = npvMid;
    } else {
      high = mid;
    }
  }

  return null;
}
