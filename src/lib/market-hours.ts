/**
 * Utilitas status jam bursa BEI (Bursa Efek Indonesia / IDX) dalam zona waktu WIB (Asia/Jakarta, UTC+7).
 *
 * Jadwal Perdagangan Reguler:
 * - Senin - Kamis:
 *   Sesi I:  09:00 - 12:00 WIB
 *   Sesi II: 13:30 - 15:49 WIB (Pra-penutupan: 15:50 - 16:00 WIB)
 * - Jumat:
 *   Sesi I:  09:00 - 11:30 WIB
 *   Sesi II: 14:00 - 15:49 WIB (Pra-penutupan: 15:50 - 16:00 WIB)
 * - Sabtu & Minggu / Hari Libur Nasional: Tutup
 */

export interface MarketStatus {
  isOpen: boolean;
  statusText: "Buka" | "Tutup";
  sessionText: string;
  timeWib: string;
  dateWib: string;
  formattedTime: string;
}

/**
 * Memeriksa apakah bursa IDX sedang dalam sesi perdagangan aktif.
 */
export function getIdxMarketStatus(date: Date = new Date()): MarketStatus {
  // Gunakan Intl untuk mengekstrak jam, menit, hari dalam zona waktu Asia/Jakarta
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const weekday = partMap.weekday; // "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const timeInMinutes = hour * 60 + minute;

  // Format tampilan WIB
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timeWib = `${pad(hour)}:${pad(minute)} WIB`;

  const dateIndoFormatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const dateWib = dateIndoFormatter.format(date);
  const formattedTime = `${dateWib}, ${timeWib}`;

  // Cek akhir pekan (Sabtu & Minggu)
  if (weekday === "Sat" || weekday === "Sun") {
    return {
      isOpen: false,
      statusText: "Tutup",
      sessionText: "Pasar Tutup (Akhir Pekan)",
      timeWib,
      dateWib,
      formattedTime,
    };
  }

  // Cek jam perdagangan
  let isOpen = false;
  let sessionText = "Pasar Tutup";

  if (weekday === "Fri") {
    // Jumat: Sesi I 09:00 - 11:30 (540 - 690 menit)
    // Sesi II 14:00 - 15:50 (840 - 950 menit)
    if (timeInMinutes >= 540 && timeInMinutes < 690) {
      isOpen = true;
      sessionText = "Sesi I (09:00 - 11:30 WIB)";
    } else if (timeInMinutes >= 690 && timeInMinutes < 840) {
      isOpen = false;
      sessionText = "Istirahat Jumat (11:30 - 14:00 WIB)";
    } else if (timeInMinutes >= 840 && timeInMinutes <= 950) {
      isOpen = true;
      sessionText = "Sesi II (14:00 - 15:50 WIB)";
    } else if (timeInMinutes < 540) {
      isOpen = false;
      sessionText = "Pra-pembukaan (Buka 09:00 WIB)";
    } else {
      isOpen = false;
      sessionText = "Pasar Tutup";
    }
  } else {
    // Senin - Kamis: Sesi I 09:00 - 12:00 (540 - 720 menit)
    // Sesi II 13:30 - 15:50 (810 - 950 menit)
    if (timeInMinutes >= 540 && timeInMinutes < 720) {
      isOpen = true;
      sessionText = "Sesi I (09:00 - 12:00 WIB)";
    } else if (timeInMinutes >= 720 && timeInMinutes < 810) {
      isOpen = false;
      sessionText = "Istirahat Siang (12:00 - 13:30 WIB)";
    } else if (timeInMinutes >= 810 && timeInMinutes <= 950) {
      isOpen = true;
      sessionText = "Sesi II (13:30 - 15:50 WIB)";
    } else if (timeInMinutes < 540) {
      isOpen = false;
      sessionText = "Pra-pembukaan (Buka 09:00 WIB)";
    } else {
      isOpen = false;
      sessionText = "Pasar Tutup";
    }
  }

  return {
    isOpen,
    statusText: isOpen ? "Buka" : "Tutup",
    sessionText,
    timeWib,
    dateWib,
    formattedTime,
  };
}
