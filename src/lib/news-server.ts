/**
 * Server-side Indonesian Capital Market & Macroeconomic RSS Fetcher & Parser.
 * Menggunakan feed RSS publik (CNBC Indonesia Market & Google News BEI/IHSG) melalui cache Next.js 16.
 */

import { LiveMarketNewsItem, LiveNewsCategory, SentimentType } from "@/types/market";
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
  "ARTO", "BBYB", "BDMN", "SMBC", "PNBN", "BTPS",
  "ASII", "AUTO", "UNTR", "ADRO", "AADI", "PTBA", "ITMG", "HRUM", "INDY", "BUMI",
  "TOBA", "BSSR", "ESSA",
  "ANTM", "INCO", "MDKA", "NCKL", "MBMA", "TINS", "BRMS", "AMMN", "ARCI", "HRTA",
  "MEDC", "ELSA", "ENRG", "PGAS", "AKRA", "RAJA", "RATU",
  "TLKM", "ISAT", "EXCL", "TBIG", "TOWR", "MTEL", "WIFI", "DCII",
  "ICBP", "INDF", "MYOR", "UNVR", "KLBF", "SIDO", "CPIN", "JPFA", "CMRY", "ULTJ",
  "AVIA", "HEAL", "MIKA", "SILO", "GGRM", "HMSP",
  "AMRT", "ACES", "MAPI", "MAPA", "ERAA", "MIDI",
  "SMGR", "INTP", "BSDE", "CTRA", "SMRA", "PWON", "DMAS", "SSIA", "PANI", "CBDK",
  "GOTO", "BUKA", "BREN", "BRPT", "TPIA", "CUAN", "PGEO", "PTRO", "JSMR", "DSSA",
  "INKP", "TKIM", "SRTG", "TAPG", "DSNG", "AALI", "LSIP", "SSMS",
  "ADHI", "PTPP", "WIKA", "SCMA", "EMTK", "MNCN",
]);

const COMPANY_NAME_TICKERS: [RegExp, string][] = [
  [/bank central asia|\bbca\b/i, "BBCA"],
  [/bank rakyat indonesia|\bbri\b/i, "BBRI"],
  [/bank mandiri/i, "BMRI"],
  [/bank negara indonesia|\bbni\b/i, "BBNI"],
  [/bank tabungan negara|\bbtn\b/i, "BBTN"],
  [/bank syariah indonesia|\bbsi\b/i, "BRIS"],
  [/cimb niaga/i, "BNGA"],
  [/bank jago/i, "ARTO"],
  [/bank aladin/i, "BANK"],
  [/astra international/i, "ASII"],
  [/united tractors/i, "UNTR"],
  [/adaro|alamtri/i, "ADRO"],
  [/aneka tambang|\bantam\b/i, "ANTM"],
  [/vale indonesia/i, "INCO"],
  [/merdeka copper/i, "MDKA"],
  [/merdeka battery/i, "MBMA"],
  [/amman mineral/i, "AMMN"],
  [/bukit asam/i, "PTBA"],
  [/indo tambangraya/i, "ITMG"],
  [/bumi resources/i, "BUMI"],
  [/telkom indonesia|\btelkom\b/i, "TLKM"],
  [/indosat/i, "ISAT"],
  [/xl axiata|xlsmart/i, "EXCL"],
  [/indofood cbp/i, "ICBP"],
  [/indofood sukses/i, "INDF"],
  [/unilever indonesia|\bunilever\b/i, "UNVR"],
  [/kalbe farma|\bkalbe\b/i, "KLBF"],
  [/sido muncul/i, "SIDO"],
  [/mayora indah|\bmayora\b/i, "MYOR"],
  [/charoen pokphand/i, "CPIN"],
  [/japfa comfeed|\bjapfa\b/i, "JPFA"],
  [/sumber alfaria|alfamart/i, "AMRT"],
  [/mitra adiperkasa/i, "MAPI"],
  [/aspirasi hidup|ace hardware/i, "ACES"],
  [/medco energi/i, "MEDC"],
  [/perusahaan gas negara|\bpgn\b/i, "PGAS"],
  [/akr corporindo/i, "AKRA"],
  [/petrosea/i, "PTRO"],
  [/petrindo jaya/i, "CUAN"],
  [/pertamina geothermal/i, "PGEO"],
  [/barito renewables/i, "BREN"],
  [/barito pacific/i, "BRPT"],
  [/chandra asri/i, "TPIA"],
  [/pantai indah kapuk|\bpik2\b/i, "PANI"],
  [/bumi serpong damai/i, "BSDE"],
  [/ciputra development/i, "CTRA"],
  [/pakuwon jati/i, "PWON"],
  [/semen indonesia/i, "SMGR"],
  [/indocement/i, "INTP"],
  [/jasa marga/i, "JSMR"],
  [/indah kiat/i, "INKP"],
  [/pabrik kertas tjiwi/i, "TKIM"],
  [/goto gojek|\bgoto\b/i, "GOTO"],
];

const NON_TICKER_CAPS = new Set([
  "IHSG", "BEI", "IDX", "OJK", "BI", "BUMN", "APBN", "APBD", "DPR", "DPRD", "RI",
  "USD", "IDR", "EUR", "JPY", "SGD", "CNY", "THE", "FED", "DPK", "KPR",
  "KUR", "PPN", "PPH", "IPO", "RUPS", "LPSK", "KPK", "BPJS", "PLN", "IKN",
  "CEO", "CFO", "ETF", "RDN", "TBK", "PT", "CV", "TMT", "HUT", "YOY", "QOQ",
  "EBITDA", "CPO", "LNG", "LPG", "BBM", "PLTU", "ESDM", "KSEI", "KPEI",
  "LQ45", "IDX30", "MSCI", "FTSE", "FOMC", "GDP", "PDB", "PMK", "UU",
  "WIB", "WITA", "UMKM", "BRIN", "BPOM", "BMKG", "BNPB", "OPEC", "NATO", "APEC", "OECD",
  "HSBC", "OCBC", "CIMB", "LIVE", "NEWS", "INFO", "FOTO", "DATA",
  "BANK", "DANA", "LABA", "RUGI", "CASA", "CAGR", "ATAS", "BARU", "DARI", "YANG",
  "AKAN", "BISA", "JADI", "UNTUK", "SAAT", "LAGI", "TURUN", "NAIK", "JUAL", "BELI",
  "RIBU", "JUTA", "RP", "HARI", "KINI", "SAMA", "LAIN", "MANA", "PADA", "OLEH",
  "PARA", "ATAU", "JIKA", "AGAR", "DEMI", "JUGA", "NAMA", "KOTA", "DESA",
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

  // Tangkap pola eksplisit "saham XXXX" / "emiten XXXX" / "(XXXX)" dengan kandidat wajib KAPITAL
  const explicitPattern =
    /(?:[sS][aA][hH][aA][mM]|[eE][mM][iI][tT][eE][nN]|\()\s*([A-Z]{4})(?:\.JK)?(?=\s|\)|,|;|\.|$)/g;
  let match: RegExpExecArray | null;
  while ((match = explicitPattern.exec(text)) !== null) {
    const candidate = match[1];
    if (/^[A-Z]{4}$/.test(candidate) && !NON_TICKER_CAPS.has(candidate)) {
      found.add(candidate);
    }
  }

  // Tangkap pola eksplisit berakhiran .JK seperti BBNI.JK
  const jkPattern = /\b([A-Z]{4})\.JK\b/g;
  while ((match = jkPattern.exec(text)) !== null) {
    const candidate = match[1];
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

const POSITIVE_SENTIMENT_PATTERN =
  /\b(menguat|rebound|melesat|melonjak|meroket|menanjak|reli|rally|naik|meningkat|tumbuh|ekspansi|surplus|cetak laba|laba naik|laba bersih naik|dividen|akumulasi|net buy|beli bersih|rekor|tertinggi|optimis|bullish|positif|menggeliat|membaik|ditopang|mendorong)\b/g;

const NEGATIVE_SENTIMENT_PATTERN =
  /\b(melemah|anjlok|merosot|terkoreksi|ambruk|terperosok|turun|menyusut|tertekan|tekanan|rugi|defisit|suspensi|gagal bayar|pailit|pkpu|net sell|jual bersih|outflow|arus keluar|terendah|pesimis|bearish|negatif|pangkas|memangkas|perlambatan|waspada)\b/g;

function countSentimentHits(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

export function analyzeNewsSentiment(title: string, summary: string): SentimentType {
  const titleLower = title.toLowerCase();
  const summaryLower = summary.toLowerCase();

  const posScore =
    countSentimentHits(titleLower, POSITIVE_SENTIMENT_PATTERN) * 2 +
    countSentimentHits(summaryLower, POSITIVE_SENTIMENT_PATTERN);
  const negScore =
    countSentimentHits(titleLower, NEGATIVE_SENTIMENT_PATTERN) * 2 +
    countSentimentHits(summaryLower, NEGATIVE_SENTIMENT_PATTERN);

  if (posScore > negScore) return "BULLISH";
  if (negScore > posScore) return "BEARISH";
  return "NEUTRAL";
}

function cleanRssSummary(rawDescTagContent: string, title: string, publisher: string): string {
  // Google News RSS sering membungkus daftar tautan <ol><li><a href="...news.google.com...">Judul</a> <font>Media</font>
  if (
    rawDescTagContent.includes("<ol>") ||
    rawDescTagContent.includes("news.google.com/rss/articles")
  ) {
    return "";
  }

  const decoded = decodeHtmlEntities(rawDescTagContent);
  if (!decoded || decoded.length < 24) return "";

  const normDesc = decoded.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normPub = publisher.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (
    !normDesc ||
    normDesc === normTitle ||
    normDesc === normPub ||
    (normTitle.length >= 20 && normDesc.startsWith(normTitle.slice(0, 24))) ||
    (normDesc.length >= 20 && normTitle.startsWith(normDesc.slice(0, 24)))
  ) {
    return "";
  }

  if (decoded.length <= 240) return decoded;
  const sliced = decoded.slice(0, 237);
  const lastSpace = sliced.lastIndexOf(" ");
  const cleanCut = lastSpace > 160 ? sliced.slice(0, lastSpace) : sliced;
  return `${cleanCut.trim()}...`;
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
    const rawDescTag = readXmlTag(rawItem, "description");
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

    const summary = cleanRssSummary(rawDescTag, title, publisher);
    const analysisText = summary ? `${title} ${summary}` : title;
    const tickers = extractIdxTickersFromText(analysisText);
    const category = categorizeNewsItem(title, summary);
    const sentiment = analyzeNewsSentiment(title, summary);

    items.push({
      id: `rss-${Buffer.from(link).toString("base64url").slice(0, 16)}-${i}`,
      title,
      link,
      publisher,
      publishedAt: validDate.toISOString(),
      publishedWib: formatWibDateTime(validDate),
      summary,
      category,
      sentiment,
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
