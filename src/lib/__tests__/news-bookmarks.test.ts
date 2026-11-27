import { describe, expect, it } from "vitest";
import {
  MAX_BOOKMARKED_NEWS,
  parseNewsBookmarksJson,
  resolveBookmarkedNewsPool,
  toggleNewsBookmark,
} from "@/lib/news-bookmarks";
import type { LiveMarketNewsItem } from "@/types/market";

const SAMPLE_STORY: LiveMarketNewsItem = {
  id: "rss-story-1",
  title: "IHSG Ditutup Menguat Ditopang Saham Perbankan Besar",
  link: "https://www.cnbcindonesia.com/market/ihsg-menguat",
  publisher: "CNBC Indonesia",
  sourceDomain: "cnbcindonesia.com",
  imageUrl: "https://awsimages.detik.net.id/visual/ihsg.jpg",
  publishedAt: "2026-11-27T10:00:00.000Z",
  publishedWib: "27 Nov 2026, 17.00 WIB",
  summary: "Saham perbankan besar mencatat arus beli bersih investor asing.",
  category: "CORPORATE",
  sentiment: "BULLISH",
  tickers: ["BBCA", "BMRI"],
};

describe("news-bookmarks localStorage helpers", () => {
  it("parses valid bookmark JSON, ignores malformed entries, and deduplicates by id", () => {
    const raw = JSON.stringify([
      SAMPLE_STORY,
      SAMPLE_STORY,
      { id: "", title: "Broken" },
      { id: "bad-url", title: "Unsafe", link: "javascript:alert(1)", publisher: "X" },
    ]);
    const parsed = parseNewsBookmarksJson(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("rss-story-1");
    expect(parsed[0].tickers).toEqual(["BBCA", "BMRI"]);
    expect(parseNewsBookmarksJson("invalid-json")).toEqual([]);
  });

  it("toggles bookmark addition/removal and caps total saved items cleanly", () => {
    const added = toggleNewsBookmark([], SAMPLE_STORY);
    expect(added).toHaveLength(1);
    expect(added[0].id).toBe("rss-story-1");

    const removed = toggleNewsBookmark(added, SAMPLE_STORY);
    expect(removed).toHaveLength(0);

    let list: LiveMarketNewsItem[] = [];
    for (let i = 0; i < MAX_BOOKMARKED_NEWS + 5; i++) {
      list = toggleNewsBookmark(list, { ...SAMPLE_STORY, id: `rss-${i}` });
    }
    expect(list).toHaveLength(MAX_BOOKMARKED_NEWS);
    expect(list[0].id).toBe(`rss-${MAX_BOOKMARKED_NEWS + 4}`);
  });

  it("prefers fresh live item metadata while retaining older saved snapshots", () => {
    const updatedLive: LiveMarketNewsItem = {
      ...SAMPLE_STORY,
      summary: "Ringkasan live terbaru.",
    };
    const archivedSaved: LiveMarketNewsItem = {
      ...SAMPLE_STORY,
      id: "rss-old-archived",
      title: "Berita Arsip Tersimpan",
    };

    const resolved = resolveBookmarkedNewsPool([updatedLive], [SAMPLE_STORY, archivedSaved]);
    expect(resolved).toHaveLength(2);
    expect(resolved[0].summary).toBe("Ringkasan live terbaru.");
    expect(resolved[1].id).toBe("rss-old-archived");
  });
});
