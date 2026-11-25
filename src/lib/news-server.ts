/**
 * Server-side Indonesian Capital Market & Macroeconomic RSS Fetcher & Parser.
 * Menggunakan feed RSS publik (CNBC Indonesia Market & Google News BEI/IHSG) melalui cache Next.js 16.
 */

import { LiveMarketNewsItem, LiveNewsCategory } from "@/types/market";
import { fetchRssTextCached } from "./yahoo-cache";

const RSS_FEEDS = [
  {
    url: "https://www.cnbcindonesia.com/market/rss",
    defaultPublisher: "CNBC Indonesia",
  },
  {
    url: "https://news.google.com/rss/search?q=IHSG+OR+saham+BEI+when:7d&hl=id&gl=ID&ceid=ID:id",
    defaultPublisher: "Google News IDX",
  },
] as const;

const KNOWN_IDX_TICKERS = new Set([
  "BBCA", "BBRI", "BMRI", "BBNI", "BBTN", "BRIS", "BNGA", "NISP", "MEGA",
  "ASII", "AUTO", "UNTR", "ADRO", "AADI", "PTBA", "ITMG", "HRUM", "INDY", "BUMI",
  "ANTM", "INCO", "MDKA", "NCKL", "MBMA", "TINS", "BRMS", "AMMN",
  "MEDC", "ELSA", "ENRG", "PGAS", "AKRA", "RAJA",
  "TLKM", "ISAT", "EXCL", "TBIG", "TOWR", "MTEL",
  "ICBP", "INDF", "MYOR", "UNVR", "KLBF", "SIDO", "CPIN", "JPFA",
  "AMRT", "ACES", "MAPI", "ERAA", "MIDI",
  "SMGR", "INTP", "BSDE", "CTRA", "SMRA", "PWON", "DMAS", "SSIA",
  "GOTO", "BUKA", "WIFI", "BREN", "TPIA", "CUAN", "PGEO", "PTRO", "JSMR",
  "SMBC", "PNBN", "BTPS",
]);

const COMPANY_NAME_TICKERS: [RegExp, string][] = [
  [/bank central asia|\bbca\b/i, "BBCA"],
  [/bank rakyat indonesia|\bbri\b/i, "BBRI"],
  [/bank mandiri/i, "BMRI"],
  [/bank negara indonesia|\bbni\b/i, "BBNI"],
  [/astra international/i, "ASII"],
  [/adaro|alamtri/i, "ADRO"],
  [/aneka tambang|antam/i, "ANTM"],
  [/telkom indonesia|\btelkom\b/i, "TLKM"],
  [/indofood cbp/i, "ICBP"],
  [/indofood sukses/i, "INDF"],
  [/medco energi/i, "MEDC"],
  [/bukit asam/i, "PTBA"],
  [/sumber alfaria|alfamart/i, "AMRT"],
  [/goto gojek/i, "GOTO"],
  [/bank syariah indonesia|\bbsi\b/i, "BRIS"],
];

const NON_TICKER_CAPS = new Set([
  "IHSG", "BEI", "IDX", "OJK", "BI", "BUMN", "APBN", "APBD", "DPR", "RI",
  "USD", "IDR", "EUR", "JPY", "SGD", "CNY", "THE", "FED", "DPK", "KPR",
  "KUR", "PPN", "PPH", "IPO", "RUPS", "LPSK", "KPK", "BPJS", "PLN", "IKN",
  "CEO", "CFO", "ETF", "RDN", "TBK", "PT", "CV", "TMT", "HUT", "YOY", "QOQ",
  "EBITDA", "CPO", "LNG", "LPG", "BBM", "PLTU", "ESDM", "KSEI", "KPEI",
  "LQ45", "IDX30", "MSCI", "FTSE", "FOMC", "GDP", "PDB", "PMK", "UU",
  "ATAS", "BARU", "DARI", "YANG", "AKAN", "BISA", "JADI", "UNTUK", "SAAT",
  "LAGI", "TURUN", "NAIK", "JUAL", "BELI", "RIBU", "JUTA", "RP", "USD",
]);

export function decodeHtmlEntities(input: string): string {
  const withoutCdata = input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Hilangkan tag HTML sebelum decoding entitas agar pola angka seperti "&lt;10%" tidak ikut terhapus
  const strippedFirst = withoutCdata.replace(/<\/?[a-zA-Z][^>]*>/g, " ");
  const decoded = strippedFirst
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&nbsp;/g, " ");
  // Bersihkan tag HTML ter-encode ganda (seperti &lt;a href=...&gt;) sambil tetap mempertahankan "<10%"
  return decoded
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractIdxTickersFromText(text: string): string[] {
  const found = new Set<string>();

  for (const [pattern, ticker] of COMPANY_NAME_TICKERS) {
    if (pattern.test(text)) {
      found.add(ticker);
    }
  }

  // Cocokkan kode 4 huruf eksplisit dari daftar emiten BEI terkenal
  const words = text.match(/\b[A-Z]{4}\b/g) || [];
  for (const w of words) {
    if (KNOWN_IDX_TICKERS.has(w) && !NON_TICKER_CAPS.has(w)) {
      found.add(w);
    }
  }

  // Tangkap pola eksplisit "saham XXXX" / "emiten XXXX" / "(XXXX)" / "XXXX.JK"
  const explicitPattern = /(?:saham|emiten|\()\s*([A-Z]{4})(?:\.JK)?(?:\s|\)|,|;|\.|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = explicitPattern.exec(text)) !== null) {
    const candidate = match[1].toUpperCase();
    if (/^[A-Z]{4}$/.test(candidate) && !NON_TICKER_CAPS.has(candidate)) {
      found.add(candidate);
    }
  }

  return Array.from(found).slice(0, 5);
}

export function categorizeNewsItem(title: string, summary: string): LiveNewsCategory {
  const txt = `${title} ${summary}`.toLowerCase();

  if (
    /bi-rate|bank indonesia|suku bunga|rupiah|kurs|dolar|\busd\b|inflasi|moneter|\bdpk\b|likuiditas|the fed|obligasi|sbn/.test(
      txt
    )
  ) {
    return "MONETARY_CURRENCY";
  }

  if (
    /minyak|brent|batubara|batu bara|nikel|emas|antam|timah|sawit|\bcpo\b|komoditas|tambang|energi|migas/.test(
      txt
    )
  ) {
    return "COMMODITIES";
  }

  if (
    /apbn|pajak|\bppn\b|danantara|bumn|presiden|menteri|fiskal|pemerintah|regulasi|\bojk\b|suspensi|\bbei\b/.test(
      txt
    )
  ) {
    return "DOMESTIC_POLITICS";
  }

  if (/amerika|\bas\b|china|tiongkok|tarif|trump|global|resesi|wall street|s&p|geopolitik/.test(txt)) {
    return "GLOBAL_MACRO";
  }

  return "CORPORATE";
}

function formatWibDateTime(dateObj: Date): string {
  if (isNaN(dateObj.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(dateObj);
  return `${formatted} WIB`;
}

function readXmlTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(regex);
  return match ? match[1] : "";
}

export function parseRssItems(xml: string, defaultPublisher: string): LiveMarketNewsItem[] {
  const items: LiveMarketNewsItem[] = [];
  const itemMatches = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];

  for (let i = 0; i < itemMatches.length; i++) {
    const rawItem = itemMatches[i];
    let title = decodeHtmlEntities(readXmlTag(rawItem, "title"));
    const link = decodeHtmlEntities(readXmlTag(rawItem, "link"));
    const pubDateStr = decodeHtmlEntities(readXmlTag(rawItem, "pubDate"));
    const rawDesc = decodeHtmlEntities(readXmlTag(rawItem, "description"));
    const rawSource = decodeHtmlEntities(readXmlTag(rawItem, "source"));

    if (!title || !link) continue;

    // Google News sering menyisipkan " - Nama Media" di akhir judul
    let publisher = rawSource || defaultPublisher;
    if (defaultPublisher === "Google News IDX" && title.includes(" - ")) {
      const lastDash = title.lastIndexOf(" - ");
      const tail = title.slice(lastDash + 3).trim();
      if (tail.length > 0 && tail.length <= 45) {
        publisher = tail;
        title = title.slice(0, lastDash).trim();
      }
    }

    const parsedDate = pubDateStr ? new Date(pubDateStr) : new Date();
    const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    // Bersihkan summary jika sama persis dengan judul (sering terjadi di Google News RSS)
    let summary = rawDesc;
    if (!summary || summary.toLowerCase().startsWith(title.toLowerCase().slice(0, 28))) {
      summary = `Laporan pasar modal dari ${publisher} mengenai perkembangan ${title}.`;
    } else if (summary.length > 260) {
      summary = `${summary.slice(0, 257).trim()}...`;
    }

    const tickers = extractIdxTickersFromText(`${title} ${summary}`);
    const category = categorizeNewsItem(title, summary);

    items.push({
      id: `rss-${Buffer.from(link).toString("base64url").slice(0, 16)}-${i}`,
      title,
      link,
      publisher,
      publishedAt: validDate.toISOString(),
      publishedWib: formatWibDateTime(validDate),
      summary,
      category,
      tickers,
    });
  }

  return items;
}

/**
 * Mengambil dan menggabungkan berita pasar modal Indonesia terkini dari RSS publik.
 */
export async function getLiveMarketNewsServer(): Promise<LiveMarketNewsItem[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const xml = await fetchRssTextCached(feed.url);
      return parseRssItems(xml, feed.defaultPublisher);
    })
  );

  const combined: LiveMarketNewsItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      combined.push(...r.value);
    }
  }

  if (combined.length === 0) {
    return [];
  }

  // Urutkan terbaru terlebih dahulu, lalu deduplikasi berdasarkan awalan judul
  combined.sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1));
  const deduped: LiveMarketNewsItem[] = [];
  const seenTitles = new Set<string>();

  for (const item of combined) {
    const norm = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 42);
    if (!norm || seenTitles.has(norm)) continue;
    seenTitles.add(norm);
    deduped.push(item);
    if (deduped.length >= 18) break;
  }

  return deduped;
}
