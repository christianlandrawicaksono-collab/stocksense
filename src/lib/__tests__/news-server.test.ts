import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yahoo-cache", () => ({
  fetchRssTextCached: vi.fn(),
}));

import {
  decodeHtmlEntities,
  extractIdxTickersFromText,
  categorizeNewsItem,
  parseRssItems,
} from "@/lib/news-server";

describe("news-server RSS helpers", () => {
  it("decodes HTML entities and strips CDATA/HTML tags cleanly", () => {
    const raw = "<![CDATA[<p>Laba &amp; Dividen &quot;BBCA&quot; Naik &lt;10%&gt;</p>]]>";
    expect(decodeHtmlEntities(raw)).toBe('Laba & Dividen "BBCA" Naik <10%>');
  });

  it("extracts real IDX tickers while ignoring uppercase stop words like IHSG, OJK, BUMN", () => {
    const text = "IHSG & OJK Soroti Kinerja BUMN seperti BBNI dan saham PTBA serta Bank Central Asia";
    const tickers = extractIdxTickersFromText(text);
    expect(tickers).toContain("BBNI");
    expect(tickers).toContain("PTBA");
    expect(tickers).toContain("BBCA");
    expect(tickers).not.toContain("IHSG");
    expect(tickers).not.toContain("BUMN");
  });

  it("categorizes macroeconomic and commodity news accurately", () => {
    expect(categorizeNewsItem("Bank Indonesia Tahan BI-Rate 6%", "Rupiah menguat")).toBe(
      "MONETARY_CURRENCY"
    );
    expect(categorizeNewsItem("Harga Minyak Brent & Batubara Menguat", "Emiten energi")).toBe(
      "COMMODITIES"
    );
  });

  it("parses Google News RSS item title suffix and publisher", () => {
    const sampleXml = `
      <rss version="2.0"><channel>
        <item>
          <title>BEI Pantau Pergerakan Saham BBNI &amp; AMRT - Bisnis Indonesia</title>
          <link>https://example.com/berita-1</link>
          <pubDate>Wed, 25 Nov 2026 06:00:00 GMT</pubDate>
          <description><![CDATA[Pergerakan saham perbankan dan ritel menguat hari ini.]]></description>
        </item>
      </channel></rss>
    `;
    const items = parseRssItems(sampleXml, "Google News IDX");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("BEI Pantau Pergerakan Saham BBNI & AMRT");
    expect(items[0].publisher).toBe("Bisnis Indonesia");
    expect(items[0].tickers).toEqual(["BBNI", "AMRT"]);
    expect(items[0].publishedWib).toContain("WIB");
  });
});
