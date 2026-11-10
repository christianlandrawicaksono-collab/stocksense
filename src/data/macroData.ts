import { MacroNewsItem, MarketTickerItem } from "../types/market";

export const LIVE_MARKET_TICKERS: MarketTickerItem[] = [
  { symbol: "IHSG", name: "Indeks Harga Saham Gabungan", value: "7,314.50", change: 0.62, isPositive: true },
  { symbol: "USD/IDR", name: "Kurs Rupiah", value: "15,820", change: -0.35, isPositive: true },
  { symbol: "BI-RATE", name: "Suku Bunga Acuan BI", value: "6.00%", change: 0.0, isPositive: true },
  { symbol: "BRENT", name: "Minyak Mentah Brent", value: "$74.80/bbl", change: 1.45, isPositive: true },
  { symbol: "NICKEL", name: "LME Nickel Cash", value: "$16,250/t", change: -0.80, isPositive: false },
  { symbol: "COAL", name: "Newcastle Coal", value: "$142.10/t", change: 0.95, isPositive: true },
  { symbol: "GOLD", name: "Emas Antam /gr", value: "Rp 1,510,000", change: 0.40, isPositive: true },
];

export const MACRO_RISK_SUMMARY = {
  currentRiskLevel: "MODERATE", // LOW | MODERATE | ELEVATED | HIGH
  score: 62, // 0 - 100
  marketRegime: "Cautious Accumulation",
  keyDriver: "Transisi suku bunga global The Fed vs Pertumbuhan domestik & stimulus APBN",
  foreignFlowStatus: "Net Inflow Mingguan +Rp 1.42 T (Rebound di Big Banks)",
  summaryBrief: "Kondisi pasar saham Indonesia saat ini ditopang oleh solidnya laba perbankan tier-1 dan penguatan tipis Rupiah, namun dibayangi kekhawatiran daya beli kelas menengah domestik (imbas wacana PPN & pajak) serta arah kebijakan tarif perdagangan global."
};

export const MACRO_NEWS_DATA: MacroNewsItem[] = [
  // --- WEEKLY FLASH (1 MINGGU TERAKHIR) ---
  {
    id: "news-w1",
    title: "The Fed Tahan Suku Bunga di Rentang 4.75% - 5.00%: BI Diproyeksi Jaga BI-Rate di 6.00%",
    period: "1W",
    date: "10 November 2026",
    category: "MONETARY_CURRENCY",
    source: "Bloomberg / Bank Indonesia",
    summary: "Rapat FOMC The Fed mengisyaratkan pendekatan bertahap dalam pemangkasan suku bunga acuan seiring data ketenagakerjaan AS yang masih resilien. Bank Indonesia diprediksi tetap mempertahankan BI-Rate di level 6.00% demi menjaga stabilitas nilai tukar Rupiah terhadap DXY.",
    catalyst: "Keputusan Suku Bunga Global & Spread Imbal Hasil Obligasi",
    marketSentiment: "NEUTRAL",
    overallImpact: "Meredakan kepanikan depresiasi Rupiah, namun membatasi ruang pelonggaran likuiditas perbankan jangka pendek.",
    sectorImpacts: [
      {
        sector: "Perbankan (Big Banks)",
        sentiment: "BULLISH",
        tickers: ["BBCA", "BMRI", "BBRI", "BBNI"],
        impactDescription: "Margin bunga bersih (NIM) tetap terjaga tinggi di level 5-6%, potensi foreign inflow kembali masuk ke saham likuid berfundamental prima."
      },
      {
        sector: "Properti & Real Estate",
        sentiment: "BEARISH",
        tickers: ["BSDE", "CTRA", "SMRA"],
        impactDescription: "Suku bunga KPR belum akan turun signifikan, pertumbuhan pra-penjualan (marketing sales) properti residensial berpotensi melambat."
      }
    ]
  },
  {
    id: "news-w2",
    title: "Eskalasi Ketegangan Selat Hormuz & Rute Maritim Global: Minyak Mentah Rebound ke $75/Barel",
    period: "1W",
    date: "8 November 2026",
    category: "GLOBAL_MACRO",
    source: "Reuters / Energy Information Admin",
    summary: "Gangguan jalur pasokan energi di kawasan Timur Tengah memicu premi risiko geopolitik baru, mendorong harga minyak mentah Brent naik 3.8% dalam sepekan. Hal ini memicu kekhawatiran beban subsidi BBM APBN namun memberikan katalis positif bagi emiten eksplorasi energi.",
    catalyst: "Ketegangan Geopolitik Timur Tengah & Risiko Logistik Maritim",
    marketSentiment: "NEUTRAL",
    overallImpact: "Tekanan inflasi energi impor untuk emiten manufaktur, tetapi berkah laba untuk emiten hulu migas.",
    sectorImpacts: [
      {
        sector: "Minyak & Gas Bumi (Hulu)",
        sentiment: "BULLISH",
        tickers: ["MEDC", "ENRG", "ELSA"],
        impactDescription: "Peningkatan rata-rata harga jual (ASP) minyak dan gas langsung mendongkrak margin operasional dan arus kas kas operasi."
      },
      {
        sector: "Konsumer & Manufaktur",
        sentiment: "BEARISH",
        tickers: ["ICBP", "INDF", "MYOR"],
        impactDescription: "Risiko lonjakan biaya logistik kemasan plastik turunan petrokimia dan distribusi bahan baku."
      }
    ]
  },
  {
    id: "news-w3",
    title: "Kemenkeu Rilis Realisasi Penerimaan Pajak & Diskusi Skema PPN: Pasar Ritel Wait and See",
    period: "1W",
    date: "6 November 2026",
    category: "DOMESTIC_POLITICS",
    source: "Kementerian Keuangan RI / CNBC Indonesia",
    summary: "Pemerintah dan DPR membahas mitigasi dampak kenaikan tarif pajak pertambahan nilai (PPN) terhadap daya beli masyarakat kelas menengah, termasuk wacana pemberian insentif khusus pada bahan pokok dan barang esensial agar tidak menekan laju konsumsi domestik.",
    catalyst: "Regulasi Fiskal Domestik & Kebijakan Tarif Pajak",
    marketSentiment: "BEARISH",
    overallImpact: "Sentimen wait-and-see menyelimuti sektor ritel modern dan otomotif karena konsumen menahan belanja sekunder.",
    sectorImpacts: [
      {
        sector: "Ritel Modern & Gaya Hidup",
        sentiment: "BEARISH",
        tickers: ["ACES", "MAPI", "ERAA"],
        impactDescription: "Konsumen kelas menengah cenderung berhemat pada pos belanja barang non-esensial dan perangkat elektronik."
      },
      {
        sector: "Konsumer Primer (FMCG)",
        sentiment: "BULLISH",
        tickers: ["ICBP", "INDF", "AMRT"],
        impactDescription: "Sifat defensif barang konsumsi pokok (makanan instan & minimarket) membuat aliran dana domestik beralih ke emiten ini."
      }
    ]
  },
  {
    id: "news-w4",
    title: "Moratorium Pembangunan Smelter Nikel Kelas II (RKEF) Diperketat: Pasokan Terkendali, Saham Tambang Naik",
    period: "1W",
    date: "4 November 2026",
    category: "COMMODITIES",
    source: "Kementerian ESDM / Kontan",
    summary: "Pemerintah menegaskan pembatasan izin baru untuk smelter nikel Rotary Kiln Electric Furnace (RKEF) berbasis Nickel Pig Iron (NPI) demi menjaga ketahanan cadangan bijih nikel saprolit dan mendorong produksi nikel sulfat untuk baterai EV (HPAL).",
    catalyst: "Kebijakan Tata Kelola Hilirisasi Mineral Nasional",
    marketSentiment: "BULLISH",
    overallImpact: "Mencegah oversupply nikel dunia berlanjut, menahan kejatuhan harga acuan nikel di bursa LME.",
    sectorImpacts: [
      {
        sector: "Pertambangan Nikel & Mineral",
        sentiment: "BULLISH",
        tickers: ["ANTM", "INCO", "NCKL", "MBMA"],
        impactDescription: "Harga jual bijih nikel domestik (HPM) diproyeksikan stabil naik, profitabilitas penambang bijih nikel murni terlindungi."
      }
    ]
  },

  // --- MONTHLY DEEP DIVE (1 BULAN TERAKHIR) ---
  {
    id: "news-m1",
    title: "Review Arah Kebijakan Kabinet Baru: Fokus Ketahanan Pangan, Energi, dan Efisiensi BUMN",
    period: "1M",
    date: "Oktober - November 2026",
    category: "DOMESTIC_POLITICS",
    source: "Sekretariat Negara / Riset Mandiri Sekuritas",
    summary: "Konsolidasi program kerja pemerintahan baru memperlihatkan alokasi anggaran masif pada sektor pangan, swasembada energi terbarukan, serta dorongan pembentukan superholding dividen BUMN. Sektor pertanian, logistik cold-chain, dan perbankan penyalur KUR menjadi penerima manfaat langsung APBN.",
    catalyst: "Arah Belanja APBN Pemerintahan Baru",
    marketSentiment: "BULLISH",
    overallImpact: "Katalis pertumbuhan struktural jangka panjang untuk emiten BUMN berkinerja tinggi serta industri agribisnis pendukung.",
    sectorImpacts: [
      {
        sector: "Perbankan BUMN (Himbara)",
        sentiment: "BULLISH",
        tickers: ["BBRI", "BMRI", "BBNI"],
        impactDescription: "Penyaluran kredit program prioritas nasional dan stabilitas dividen jumbo untuk setoran kas negara."
      },
      {
        sector: "Pertanian & Perkebunan",
        sentiment: "BULLISH",
        tickers: ["TAPG", "DSNG", "SIMP"],
        impactDescription: "Dorongan program biodiesel mandiri (B40/B50) memperkuat serapan minyak sawit mentah (CPO) dalam negeri."
      },
      {
        sector: "Semen & Bahan Bangunan",
        sentiment: "NEUTRAL",
        tickers: ["SMGR", "INTP"],
        impactDescription: "Fokus anggaran bergeser dari mega-proyek fisik baru ke program perlindungan sosial dan fasilitas pedesaan."
      }
    ]
  },
  {
    id: "news-m2",
    title: "Dinamika Pemilu AS & Potensi Gelombang Tarif Dagang Baru: Implikasi terhadap Mitra Dagang Asia",
    period: "1M",
    date: "Oktober - November 2026",
    category: "GLOBAL_MACRO",
    source: "Financial Times / CSIS",
    summary: "Perkembangan politik Washington mengisyaratkan proteksionisme tarif impor terhadap produk asal Asia (khususnya Tiongkok). Meskipun menimbulkan ketidakpastian arus perdagangan, Indonesia berpeluang menjadi target relokasi rantai pasok industri global (friend-shoring).",
    catalyst: "Kebijakan Tarif & Ketegangan Perdagangan AS-Tiongkok",
    marketSentiment: "NEUTRAL",
    overallImpact: "Volatilitas indeks saham regional meningkat, namun kawasan industri di Indonesia menikmati lonjakan permintaan lahan pabrik baru.",
    sectorImpacts: [
      {
        sector: "Kawasan Industri",
        sentiment: "BULLISH",
        tickers: ["DMAS", "SSIA", "BEST"],
        impactDescription: "Lonjakan minat investasi pabrik manufaktur dan data center internasional yang merelokasi fasilitas keluar dari Tiongkok."
      },
      {
        sector: "Otomotif & Komponen",
        sentiment: "BEARISH",
        tickers: ["ASII", "AUTO"],
        impactDescription: "Kompetisi sengit dari masuknya mobil listrik (EV) murah asal produsen Tiongkok yang mencari pasar alternatif di ASEAN."
      }
    ]
  },
  {
    id: "news-m3",
    title: "Tren Musim Laporan Keuangan Q3 Emiten IDX: Laba Perbankan Pecah Rekor, Saham Komoditas Tahan Banting",
    period: "1M",
    date: "Oktober - November 2026",
    category: "DOMESTIC_POLITICS",
    source: "Bursa Efek Indonesia (IDX)",
    summary: "Rangkuman laba kuartal III 2026 mencatat BBCA, BMRI, dan BBRI sukses mencetak rekor laba bersih kumulatif berkat penurunan beban provisi (Cost of Credit). Sementara emiten batubara seperti ADRO dan PTBA membukukan kas berlimpah yang membuka peluang pembagian dividen interim menarik.",
    catalyst: "Kinerja Laba Bersih & Prospek Dividen Akhir Tahun",
    marketSentiment: "BULLISH",
    overallImpact: "Memicu 'dividend hunter rally' menjelang penutupan tahun buku di saham-saham pembagi dividen yield tinggi.",
    sectorImpacts: [
      {
        sector: "Energi & Batubara",
        sentiment: "BULLISH",
        tickers: ["ADRO", "PTBA", "ITMG"],
        impactDescription: "Yield dividen interim historis di kisaran 8-14% menjadi jangkar penahan penurunan harga saham saat koreksi."
      },
      {
        sector: "Telekomunikasi",
        sentiment: "NEUTRAL",
        tickers: ["TLKM", "ISAT", "EXCL"],
        impactDescription: "Pertumbuhan ARPU stabil, namun beban capex infrastruktur fiber dan data center AI masih membebani arus kas bebas."
      }
    ]
  },
  {
    id: "news-m4",
    title: "Arus Dana Asing (Foreign Flow) Bulanan: Reversal Akumulasi Rp 4.8 Triliun Setelah 3 Bulan Outflow",
    period: "1M",
    date: "Oktober - November 2026",
    category: "MONETARY_CURRENCY",
    source: "IDX Data Service",
    summary: "Investor institusi asing kembali mencatatkan net buy signifikan sebesar Rp 4.8 Triliun di pasar reguler, mengakhiri tren pelepasan aset beruntun sejak kuartal kedua. Valuasi saham IDX yang relatif diskon (P/E trailing 13.2x) dibandingkan rerata 5 tahun (15.5x) memicu aksi buyback asing.",
    catalyst: "Valuasi Diskon Saham Indonesia & Rebalancing Portofolio Global",
    marketSentiment: "BULLISH",
    overallImpact: "IHSG berhasil bertahan di atas level psikologis 7,300 dengan likuiditas harian menembus rata-rata Rp 11.5 T per hari.",
    sectorImpacts: [
      {
        sector: "Indeks LQ45 & Bluechip",
        sentiment: "BULLISH",
        tickers: ["BBCA", "BMRI", "ASII", "TLKM", "BBRI"],
        impactDescription: "Menjadi keranjang utama pembelian asing, mendorong penguatan harga rata-rata bobot terbesar indeks."
      }
    ]
  }
];

