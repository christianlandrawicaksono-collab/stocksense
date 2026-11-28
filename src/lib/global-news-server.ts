/**
 * Server-side Global Financial RSS Aggregator untuk 3D World News Scrollytelling.
 * Menggunakan feed RSS publik terpercaya (CNBC World/Markets, BBC Business, Google News Global)
 * melalui lapisan cache Next.js 16 fetchRssTextCached.
 */

import { createHash } from "node:crypto";
import {
  GLOBAL_NEWS_CHAPTERS,
  GlobalNewsItem,
  GlobalNewsPinId,
  buildFallbackGlobalNewsItems,
  classifyGlobalNewsRegion,
  detectGlobalNewsSentiment,
} from "./global-news";
import { fetchRssTextCached } from "./yahoo-cache";

interface GlobalFeedSource {
  url: string;
  defaultPublisher: string;
  maxItems: number;
  regionHint?: GlobalNewsPinId;
}

const GLOBAL_RSS_FEEDS: readonly GlobalFeedSource[] = [
  {
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362",
    defaultPublisher: "CNBC World",
    maxItems: 12,
    regionHint: "US",
  },
  {
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    defaultPublisher: "CNBC Finance",
    maxItems: 12,
    regionHint: "US",
  },
  {
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    defaultPublisher: "BBC Business",
    maxItems: 12,
    regionHint: "EU",
  },
  {
    url: "https://news.google.com/rss/search?q=stock+market+OR+Federal+Reserve+OR+oil+OR+OPEC+when:4d&hl=en-US&gl=US&ceid=US:en",
    defaultPublisher: "Global Markets Wire",
    maxItems: 10,
    regionHint: "US",
  },
  {
    url: "https://news.google.com/rss/search?q=China+economy+OR+Nikkei+OR+Middle+East+oil+OR+Europe+markets+when:4d&hl=en-US&gl=US&ceid=US:en",
    defaultPublisher: "Asia & EMEA Wire",
    maxItems: 12,
    regionHint: "CN",
  },
];

const GLOBAL_NEWS_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_GLOBAL_NEWS_AGE_MS = 5 * 24 * 60 * 60 * 1000;

let globalNewsCache: {
  items: GlobalNewsItem[];
  isFallback: boolean;
  cachedAt: number;
} | null = null;

function stripCdataAndHtml(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/<[^>]*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tagName: string): string {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(re);
  return match ? stripCdataAndHtml(match[1]) : "";
}

function formatWibShort(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "Terkini";
  try {
    return (
      new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d) + " WIB"
    );
  } catch {
    return "Terkini";
  }
}

function parseGlobalRssXml(xml: string, source: GlobalFeedSource): GlobalNewsItem[] {
  const items: GlobalNewsItem[] = [];
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const nowMs = Date.now();
  const chapterMap = new Map(GLOBAL_NEWS_CHAPTERS.map((c) => [c.id, c]));

  for (const block of itemMatches) {
    if (items.length >= source.maxItems) break;

    let title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const description = extractTag(block, "description");
    const pubDateRaw = extractTag(block, "pubDate");
    const sourceTag = extractTag(block, "source");

    if (!title || !link || !/^https?:\/\//i.test(link)) continue;

    // Bersihkan akhiran "- Publisher" pada Google News
    let publisher = sourceTag || source.defaultPublisher;
    if (title.includes(" - ")) {
      const parts = title.split(" - ");
      const tail = parts[parts.length - 1].trim();
      if (tail.length >= 2 && tail.length <= 36) {
        if (!sourceTag) publisher = tail;
        title = parts.slice(0, -1).join(" - ").trim();
      }
    }

    const parsedTs = pubDateRaw ? Date.parse(pubDateRaw) : nowMs;
    const validTs = Number.isFinite(parsedTs) ? parsedTs : nowMs;
    if (nowMs - validTs > MAX_GLOBAL_NEWS_AGE_MS) continue;

    const publishedAt = new Date(validTs).toISOString();
    const cleanDesc =
      description &&
      description.toLowerCase() !== title.toLowerCase() &&
      !description.toLowerCase().startsWith(title.toLowerCase().slice(0, 32))
        ? description.slice(0, 180)
        : "";
    const summary = cleanDesc || `Laporan pasar global terkini dari ${publisher}.`;

    const { regionId, chapterId } = classifyGlobalNewsRegion(
      title,
      summary,
      source.regionHint
    );
    const chapterMeta = chapterMap.get(chapterId);
    const sentiment = detectGlobalNewsSentiment(title, summary);

    const id = createHash("sha1")
      .update(`${title}|${link}`)
      .digest("hex")
      .slice(0, 12);

    items.push({
      id: `glb-${id}`,
      regionId,
      chapterId,
      title,
      summary,
      publisher,
      publishedAt,
      publishedWib: formatWibShort(publishedAt),
      link,
      language: "EN",
      sentiment,
      impactTickers: chapterMeta?.sensitiveBeiTickers.slice(0, 4) ?? ["BBCA", "BMRI"],
      isFallback: false,
    });
  }

  return items;
}

export async function getGlobalNewsServer(): Promise<{
  items: GlobalNewsItem[];
  isFallback: boolean;
}> {
  const now = Date.now();
  if (globalNewsCache && now - globalNewsCache.cachedAt < GLOBAL_NEWS_CACHE_TTL_MS) {
    return {
      items: globalNewsCache.items,
      isFallback: globalNewsCache.isFallback,
    };
  }

  const settled = await Promise.allSettled(
    GLOBAL_RSS_FEEDS.map(async (feed) => {
      const xml = await fetchRssTextCached(feed.url);
      return parseGlobalRssXml(xml, feed);
    })
  );

  const merged: GlobalNewsItem[] = [];
  const seen = new Set<string>();

  for (const res of settled) {
    if (res.status !== "fulfilled") continue;
    for (const item of res.value) {
      const normKey = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 44);
      if (!normKey || seen.has(normKey)) continue;
      seen.add(normKey);
      merged.push(item);
    }
  }

  if (merged.length === 0) {
    return {
      items: buildFallbackGlobalNewsItems(),
      isFallback: true,
    };
  }

  merged.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const topItems = merged.slice(0, 40);

  globalNewsCache = {
    items: topItems,
    isFallback: false,
    cachedAt: now,
  };

  return { items: topItems, isFallback: false };
}
