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
 * Kalender Hari Libur Bursa Resmi BEI (IDX) Tahun 2026 - Semester I 2027 (YYYY-MM-DD WIB).
 */
const IDX_HOLIDAYS_WIB: Record<string, string> = {
  // 2026
  "2026-01-01": "Tahun Baru 2026",
  "2026-01-16": "Isra Mikraj 1447 H",
  "2026-02-16": "Cuti Bersama Tahun Baru Imlek",
  "2026-02-17": "Tahun Baru Imlek 2577",
  "2026-03-19": "Cuti Bersama Hari Suci Nyepi",
  "2026-03-20": "Hari Suci Nyepi 1948",
  "2026-04-03": "Wafat Yesus Kristus",
  "2026-05-14": "Kenaikan Yesus Kristus",
  "2026-05-15": "Cuti Bersama Kenaikan Yesus Kristus",
  "2026-05-27": "Cuti Bersama Iduladha 1447 H",
  "2026-05-28": "Cuti Bersama Iduladha 1447 H",
  "2026-05-29": "Iduladha 1447 H",
  "2026-06-01": "Hari Lahir Pancasila",
  "2026-06-16": "Tahun Baru Islam 1448 H",
  "2026-08-17": "Hari Kemerdekaan RI",
  "2026-08-25": "Maulid Nabi Muhammad S.A.W.",
  "2026-12-24": "Cuti Bersama Natal",
  "2026-12-25": "Hari Raya Natal",
  "2026-12-31": "Libur Bursa Akhir Tahun",
  // 2027
  "2027-01-01": "Tahun Baru 2027",
  "2027-01-05": "Isra Mikraj 1448 H",
  "2027-02-05": "Cuti Bersama Tahun Baru Imlek",
  "2027-03-08": "Hari Suci Nyepi 1949",
  "2027-03-09": "Cuti Bersama Idul Fitri 1448 H",
  "2027-03-10": "Idul Fitri 1448 H",
  "2027-03-11": "Idul Fitri 1448 H",
  "2027-03-12": "Cuti Bersama Idul Fitri 1448 H",
  "2027-03-15": "Cuti Bersama Idul Fitri 1448 H",
  "2027-03-25": "Cuti Bersama Wafat Yesus Kristus",
  "2027-03-26": "Wafat Yesus Kristus",
  "2027-05-06": "Kenaikan Yesus Kristus",
  "2027-05-17": "Cuti Bersama Iduladha 1448 H",
  "2027-05-18": "Iduladha 1448 H",
  "2027-05-19": "Cuti Bersama Iduladha 1448 H",
  "2027-05-20": "Cuti Bersama Iduladha 1448 H",
  "2027-08-17": "Hari Kemerdekaan RI",
  "2027-12-25": "Hari Raya Natal",
};

/**
 * Memeriksa apakah bursa IDX sedang dalam sesi perdagangan aktif.
 */
export function getIdxMarketStatus(date: Date = new Date()): MarketStatus {
  // Gunakan hourCycle: "h23" agar tengah malam (00:xx WIB) tidak terbaca "24:xx"
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
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const weekday = partMap.weekday; // "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
  const hour = parseInt(partMap.hour, 10) % 24;
  const minute = parseInt(partMap.minute, 10);
  const timeInMinutes = hour * 60 + minute;
  const isoDateWib = `${partMap.year}-${partMap.month}-${partMap.day}`;

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

  // Cek hari libur bursa BEI
  const holidayName = IDX_HOLIDAYS_WIB[isoDateWib];
  if (holidayName) {
    return {
      isOpen: false,
      statusText: "Tutup",
      sessionText: `Libur Bursa (${holidayName})`,
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
