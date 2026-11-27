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
  isMarketOrMacroRelevant,
  isTrustedNewsPublisher,
  isWithinMaxNewsAge,
  getLiveMarketNewsServer,
  getTickerNewsServer,
  getLiveMarketNewsWithWatchlistServer,
} from "@/lib/news-server";
import { fetchRssTextCached } from "@/lib/yahoo-cache";

describe("news-server RSS helpers", () => {
  it("decodes HTML entities and strips CDATA/HTML tags and zero-width spaces cleanly", () => {
    const raw =
      "<![CDATA[<p>Laba &amp; Dividen &quot;BBCA&quot; Naik &lt;10%&gt; &#8203; &nbsp;selesai.</p>]]>";
    expect(decodeHtmlEntities(raw)).toBe('Laba & Dividen "BBCA" Naik <10%> selesai.');
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

    const acronymText =
      "Rencana Kerja dan Anggaran Perusahaan (RKAP) BUMN bahas penyertaan modal (PMN) serta standar (PSAK) dan PT Nusantara Sawit Sejahtera Tbk (NSSS)";
    const acronymTickers = extractIdxTickersFromText(acronymText);
    expect(acronymTickers).toEqual(["NSSS"]);
    expect(acronymTickers).not.toContain("RKAP");
    expect(acronymTickers).not.toContain("PMN");
    expect(acronymTickers).not.toContain("PSAK");
  });

  it("categorizes macroeconomic, regulatory, and commodity news accurately", () => {
    expect(categorizeNewsItem("Bank Indonesia Tahan BI-Rate 6%", "Rupiah menguat")).toBe(
      "MONETARY_CURRENCY"
    );
    expect(
      categorizeNewsItem("BEI Percepat Reformasi Transparansi Likuiditas dan Pengawasan", "")
    ).toBe("DOMESTIC_POLITICS");
    expect(
      categorizeNewsItem(
        "IHSG ditutup menguat seiring optimisme window dressing akhir tahun",
        "Indeks Harga Saham Gabungan (IHSG) Bursa Efek Indonesia (BEI) ditutup menguat."
      )
    ).toBe("CORPORATE");
    expect(categorizeNewsItem("Likuiditas Perbankan Ketat Menjelang Akhir Tahun", "")).toBe(
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
          <source url="https://investasi.kontan.co.id">Kontan</source>
        </item>
      </channel></rss>
    `;
    const items = parseRssItems(googleNewsXml, "Google News IDX");
    expect(items).toHaveLength(1);
    expect(items[0].summary).toBe("");
    expect(items[0].sentiment).toBe("BEARISH");
    expect(items[0].imageUrl).toBeUndefined();
    expect(items[0].sourceDomain).toBe("investasi.kontan.co.id");
  });

  it("extracts imageUrl from enclosure and description img tags while decoding &amp; and deriving sourceDomain", () => {
    const cnbcAndAntaraXml = `
      <rss version="2.0"><channel>
        <item>
          <title><![CDATA[Rights Issue, BSI (BRIS) Mau Terbitkan 6,8 Miliar Saham]]></title>
          <link>https://www.cnbcindonesia.com/market/20261126-bris</link>
          <pubDate>Thu, 26 Nov 2026 10:05:37 +0700</pubDate>
          <enclosure length="25000" type="image/jpeg" url="https://awsimages.detik.net.id/visual/2026/10/27/bsi.jpeg?w=1200&amp;q=90"/>
          <description><![CDATA[BRIS akan melakukan rights issue dengan menerbitkan saham baru.]]></description>
        </item>
        <item>
          <title>IHSG menguat ikuti bursa Asia</title>
          <link>https://www.antaranews.com/berita/5879347/ihsg-menguat</link>
          <pubDate>Thu, 26 Nov 2026 10:13:47 +0700</pubDate>
          <description><![CDATA[<img src="https://img.antaranews.com/cache/800x533/ihsg.jpg" align="left" border="0" />IHSG bergerak menguat mengikuti bursa Asia hari ini.]]></description>
        </item>
      </channel></rss>
    `;

    const cnbcItems = parseRssItems(cnbcAndAntaraXml, "CNBC Indonesia");
    expect(cnbcItems).toHaveLength(2);
    expect(cnbcItems[0].id).not.toBe(cnbcItems[1].id);
    // Items at index 0 from separate feeds sharing "https://www." prefix must never collide
    const singleCnbc = parseRssItems(
      `<rss version="2.0"><channel><item><title>Berita Satu</title><link>https://www.cnbcindonesia.com/market/news-a</link></item></channel></rss>`,
      "CNBC Indonesia"
    );
    const singleAntara = parseRssItems(
      `<rss version="2.0"><channel><item><title>Berita Dua</title><link>https://www.antaranews.com/berita/news-b</link></item></channel></rss>`,
      "ANTARA Ekonomi"
    );
    expect(singleCnbc[0].id).not.toBe(singleAntara[0].id);
    expect(cnbcItems[0].imageUrl).toBe(
      "https://awsimages.detik.net.id/visual/2026/10/27/bsi.jpeg?w=1200&q=90"
    );
    expect(cnbcItems[0].sourceDomain).toBe("cnbcindonesia.com");
    expect(cnbcItems[1].imageUrl).toBe("https://img.antaranews.com/cache/800x533/ihsg.jpg");
    expect(cnbcItems[1].sourceDomain).toBe("antaranews.com");
    expect(cnbcItems[1].summary).toBe("IHSG bergerak menguat mengikuti bursa Asia hari ini.");
  });

  it("merges main feed matches and ticker-specific RSS items in getTickerNewsServer", async () => {
    const mockedFetch = vi.mocked(fetchRssTextCached);
    mockedFetch.mockImplementation(async (url: string) => {
      if (url.includes("saham+UNVR")) {
        return `
          <rss version="2.0"><channel>
            <item>
              <title>Unilever Indonesia Bagikan Dividen Interim - Kontan</title>
              <link>https://news.google.com/rss/articles/unvr-div</link>
              <pubDate>Thu, 26 Nov 2026 04:00:00 GMT</pubDate>
              <description><![CDATA[Emiten barang konsumsi UNVR membagikan dividen.]]></description>
            </item>
          </channel></rss>
        `;
      }
      return `
        <rss version="2.0"><channel>
          <item>
            <title>IHSG Menguat Tipis Jelang Penutupan</title>
            <link>https://www.cnbcindonesia.com/market/ihsg-tipis</link>
            <pubDate>Thu, 26 Nov 2026 05:00:00 GMT</pubDate>
            <description><![CDATA[Indeks bergerak di zona hijau.]]></description>
          </item>
        </channel></rss>
      `;
    });

    const results = await getTickerNewsServer("UNVR");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Unilever Indonesia Bagikan Dividen Interim");
    expect(results[0].tickers).toContain("UNVR");
  });

  it("enriches main feed with watchlist-specific articles while preserving general market stories", async () => {
    const mockedFetch = vi.mocked(fetchRssTextCached);
    mockedFetch.mockImplementation(async (url: string) => {
      if (url.includes("saham+ACES")) {
        return `
          <rss version="2.0"><channel>
            <item>
              <title>Aspirasi Hidup Indonesia (ACES) Perluas Gerai Baru - Kontan</title>
              <link>https://news.google.com/rss/articles/aces-exp</link>
              <pubDate>Thu, 26 Nov 2026 03:30:00 GMT</pubDate>
              <description><![CDATA[ACES menambah gerai baru pada kuartal ini.]]></description>
            </item>
          </channel></rss>
        `;
      }
      return `
        <rss version="2.0"><channel>
          <item>
            <title>IHSG Menguat Tipis Jelang Penutupan</title>
            <link>https://www.cnbcindonesia.com/market/ihsg-tipis</link>
            <pubDate>Thu, 26 Nov 2026 05:00:00 GMT</pubDate>
            <description><![CDATA[Indeks bergerak di zona hijau.]]></description>
          </item>
        </channel></rss>
      `;
    });

    const combined = await getLiveMarketNewsWithWatchlistServer(["ACES"]);
    const titles = combined.map((i) => i.title);
    expect(titles).toContain("Aspirasi Hidup Indonesia (ACES) Perluas Gerai Baru");
    expect(titles).toContain("IHSG Menguat Tipis Jelang Penutupan");
  });

  it("enforces the 3-day maximum age window and filters non-market fluff from general feeds", async () => {
    const fixedNow = Date.parse("2026-11-27T12:00:00.000Z");
    expect(isWithinMaxNewsAge("2026-11-27T10:00:00.000Z", fixedNow)).toBe(true);
    expect(isWithinMaxNewsAge("2026-11-24T13:00:00.000Z", fixedNow)).toBe(true);
    expect(isWithinMaxNewsAge("2026-11-24T11:00:00.000Z", fixedNow)).toBe(false);

    expect(
      isMarketOrMacroRelevant({
        id: "rel-1",
        title: "Bank Indonesia Pertahankan Suku Bunga Acuan",
        link: "https://example.com/bi",
        publisher: "CNN Indonesia",
        publishedAt: "2026-11-27T10:00:00.000Z",
        publishedWib: "27 Nov 2026, 17.00 WIB",
        summary: "",
        category: "MONETARY_CURRENCY",
        sentiment: "NEUTRAL",
        tickers: [],
      })
    ).toBe(true);
    expect(
      isMarketOrMacroRelevant({
        id: "rel-2",
        title: "Resep Kue Kering Populer untuk Liburan Akhir Pekan",
        link: "https://example.com/kue",
        publisher: "CNN Indonesia",
        publishedAt: "2026-11-27T10:00:00.000Z",
        publishedWib: "27 Nov 2026, 17.00 WIB",
        summary: "Tips membuat kue sederhana di rumah.",
        category: "CORPORATE",
        sentiment: "NEUTRAL",
        tickers: [],
      })
    ).toBe(false);

    const mockedFetch = vi.mocked(fetchRssTextCached);
    mockedFetch.mockImplementation(async (url: string) => {
      if (url.includes("cnnindonesia.com/ekonomi/rss")) {
        return `
          <rss version="2.0"><channel>
            <item>
              <title>Resep Kue Kering Viral Akhir Pekan</title>
              <link>https://www.cnnindonesia.com/ekonomi/kue-viral</link>
              <pubDate>Fri, 27 Nov 2026 10:00:00 GMT</pubDate>
              <description><![CDATA[Tips kuliner akhir pekan untuk keluarga.]]></description>
            </item>
            <item>
              <title>BI Pertahankan Suku Bunga, Rupiah Stabil</title>
              <link>https://www.cnnindonesia.com/ekonomi/bi-rupiah</link>
              <pubDate>Fri, 27 Nov 2026 09:00:00 GMT</pubDate>
              <enclosure url="https://akcdn.detik.net.id/visual/2026/11/27/bi.jpg" type="image/jpeg" />
              <description><![CDATA[Bank Indonesia menjaga stabilitas kurs rupiah di pasar keuangan.]]></description>
            </item>
          </channel></rss>
        `;
      }
      if (url.includes("cnbcindonesia.com/market/rss")) {
        return `
          <rss version="2.0"><channel>
            <item>
              <title>Berita Lama IHSG 5 Hari Lalu</title>
              <link>https://www.cnbcindonesia.com/market/ihsg-lama</link>
              <pubDate>Sun, 22 Nov 2026 05:00:00 GMT</pubDate>
              <description><![CDATA[Berita lima hari lalu yang harus tersaring keluar.]]></description>
            </item>
            <item>
              <title>Saham BBCA Menguat Didorong Net Buy Asing</title>
              <link>https://www.cnbcindonesia.com/market/bbca-naik</link>
              <pubDate>Tue, 24 Nov 2026 15:00:00 GMT</pubDate>
              <enclosure url="https://awsimages.detik.net.id/visual/bbca.jpg" type="image/jpeg" />
              <description><![CDATA[Arus beli bersih investor asing menopang saham perbankan besar.]]></description>
            </item>
          </channel></rss>
        `;
      }
      return `<rss version="2.0"><channel></channel></rss>`;
    });

    expect(isTrustedNewsPublisher("Kontan Investasi", "investasi.kontan.co.id")).toBe(true);
    expect(isTrustedNewsPublisher("Bloomberg Technoz", "bloombergtechnoz.com")).toBe(true);
    expect(isTrustedNewsPublisher("roompi.id", "roompi.id")).toBe(false);
    expect(isTrustedNewsPublisher("cwibc.co.id", "cwibc.co.id")).toBe(false);

    const freshItems = await getLiveMarketNewsServer(fixedNow);
    const titles = freshItems.map((item) => item.title);
    expect(titles).toContain("BI Pertahankan Suku Bunga, Rupiah Stabil");
    expect(titles).toContain("Saham BBCA Menguat Didorong Net Buy Asing");
    expect(titles).not.toContain("Berita Lama IHSG 5 Hari Lalu");
    expect(titles).not.toContain("Resep Kue Kering Viral Akhir Pekan");
  });
});
