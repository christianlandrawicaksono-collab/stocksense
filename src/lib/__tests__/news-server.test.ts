import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yahoo-cache", () => ({
  fetchRssTextCached: vi.fn(),
}));

import {
  decodeHtmlEntities,
  extractIdxTickersFromText,
  categorizeNewsItem,
  analyzeNewsSentiment,
  parseRssItems,
} from "@/lib/news-server";

describe("news-server RSS helpers", () => {
  it("decodes HTML entities and strips CDATA/HTML tags cleanly", () => {
    const raw = "<![CDATA[<p>Laba &amp; Dividen &quot;BBCA&quot; Naik &lt;10%&gt;</p>]]>";
    expect(decodeHtmlEntities(raw)).toBe('Laba & Dividen "BBCA" Naik <10%>');
  });

  it("extracts real IDX tickers while ignoring uppercase stop words and lowercase words", () => {
    const explicitText =
      "IHSG & OJK Soroti saham bank (atau) BUMN seperti BBNI, BRPT.JK, dan saham NSSS serta CUAN";
    const tickers = extractIdxTickersFromText(explicitText);
    expect(tickers).toEqual(expect.arrayContaining(["BBNI", "BRPT", "NSSS", "CUAN"]));
    expect(tickers).not.toContain("IHSG");
    expect(tickers).not.toContain("BUMN");
    expect(tickers).not.toContain("BANK");
    expect(tickers).not.toContain("ATAU");

    const companyText =
      "Unilever, Bank Jago, dan Amman Mineral menopang rotasi sektor dengan Vale Indonesia";
    const companyTickers = extractIdxTickersFromText(companyText);
    expect(companyTickers).toEqual(expect.arrayContaining(["UNVR", "ARTO", "AMMN", "INCO"]));
  });

  it("categorizes macroeconomic and commodity news accurately", () => {
    expect(categorizeNewsItem("Bank Indonesia Tahan BI-Rate 6%", "Rupiah menguat")).toBe(
      "MONETARY_CURRENCY"
    );
    expect(categorizeNewsItem("Harga Minyak Brent & Batubara Menguat", "Emiten energi")).toBe(
      "COMMODITIES"
    );
  });

  it("scores news sentiment accurately for bullish, bearish, and neutral headlines", () => {
    expect(analyzeNewsSentiment("IHSG Menguat Tajam Ditopang Net Buy Asing di Saham BBCA", "")).toBe(
      "BULLISH"
    );
    expect(analyzeNewsSentiment("Saham Ritel Anjlok dan Tertekan Net Sell Investor Asing", "")).toBe(
      "BEARISH"
    );
    expect(analyzeNewsSentiment("Bank Indonesia Menggelar Rapat Dewan Gubernur Bulan Ini", "")).toBe(
      "NEUTRAL"
    );
  });

  it("parses Google News RSS item title suffix, publisher, and sentiment", () => {
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
    expect(items[0].sentiment).toBe("BULLISH");
    expect(items[0].summary).toBe("Pergerakan saham perbankan dan ritel menguat hari ini.");
    expect(items[0].publishedWib).toContain("WIB");
  });

  it("omits repetitive synthetic summary when Google News description only repeats headlines/links", () => {
    const googleNewsXml = `
      <rss version="2.0"><channel>
        <item>
          <title>IHSG Melemah ke 7.200 Akibat Tekanan Jual - Kontan</title>
          <link>https://news.google.com/rss/articles/abc123</link>
          <pubDate>Wed, 25 Nov 2026 07:00:00 GMT</pubDate>
          <description><![CDATA[<ol><li><a href="https://news.google.com/rss/articles/abc123">IHSG Melemah ke 7.200 Akibat Tekanan Jual</a> <font>Kontan</font></li></ol>]]></description>
        </item>
      </channel></rss>
    `;
    const items = parseRssItems(googleNewsXml, "Google News IDX");
    expect(items).toHaveLength(1);
    expect(items[0].summary).toBe("");
    expect(items[0].sentiment).toBe("BEARISH");
  });
});
