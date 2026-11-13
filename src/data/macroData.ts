import { MacroNewsItem, MarketTickerItem } from "../types/market";

export const LIVE_MARKET_TICKERS: MarketTickerItem[] = [
  { symbol: "IHSG", name: "Indeks Harga Saham Gabungan", value: "7.314,50", change: 0.62, isPositive: true },
  { symbol: "USD/IDR", name: "Kurs Rupiah", value: "15.820", change: -0.35, isPositive: true },
  { symbol: "BI-RATE", name: "Suku Bunga Acuan BI", value: "6,00%", change: 0.0, isPositive: true },
  { symbol: "BRENT", name: "Minyak Mentah Brent", value: "$74,80/bbl", change: 1.45, isPositive: true },
  { symbol: "NICKEL", name: "LME Nickel Cash", value: "$16.250/t", change: -0.80, isPositive: false },
  { symbol: "COAL", name: "Newcastle Coal", value: "$142,10/t", change: 0.95, isPositive: true },
  { symbol: "GOLD", name: "Emas Antam /gr", value: "Rp 1.510.000", change: 0.40, isPositive: true },
];

export const MACRO_MARKET_SUMMARY = {
  summaryBrief: "Kondisi pasar saham Indonesia saat ini ditopang oleh solidnya laba perbankan tier-1 dan penguatan tipis Rupiah, namun dibayangi kekhawatiran daya beli kelas menengah domestik serta arah kebijakan tarif perdagangan global."
};

export const MACRO_NEWS_DATA: MacroNewsItem[] = [
  // --- MINGGUAN (1 MINGGU TERAKHIR) ---
  {
    id: "news-w1",
    title: "Bank sentral AS menahan suku bunga di rentang 4,75% – 5,00%: Bank Indonesia diproyeksikan jaga BI-Rate di level 6,00%",
    period: "1W",
    date: "10 November 2026",
    category: "MONETARY_CURRENCY",
    source: "Contoh skenario transmisi kebijakan",
    summary: "Rapat penentuan suku bunga mengisyaratkan pendekatan bertahap dalam pelonggaran moneter seiring data ketenagakerjaan yang masih resilien. Bank Indonesia diprediksi tetap mempertahankan BI-Rate di level 6,00% demi menjaga stabilitas nilai tukar Rupiah terhadap mata uang global.",
    catalyst: "Keputusan suku bunga global dan selisih imbal hasil obligasi",
    marketSentiment: "NEUTRAL",
    overallImpact: "Meredakan kepanikan depresiasi Rupiah, namun membatasi ruang pelonggaran likuiditas perbankan jangka pendek.",
    sectorImpacts: [
      {
        sector: "Perbankan besar",
        sentiment: "BULLISH",
        tickers: ["BBCA", "BMRI", "BBRI", "BBNI"],
        impactDescription: "Margin bunga bersih tetap terjaga di level 5–6%, potensi aliran modal masuk kembali ke saham likuid berfundamental prima."
      },
      {
        sector: "Properti",
        sentiment: "BEARISH",
        tickers: ["BSDE", "CTRA", "SMRA"],
        impactDescription: "Suku bunga kredit pemilikan rumah belum akan turun signifikan, pertumbuhan pra-penjualan properti berpotensi melambat."
      }
    ]
  },
  {
    id: "news-w2",
    title: "Eskalasi ketegangan jalur pasokan maritim: Harga minyak mentah dunia naik ke level $74,80 per barel",
    period: "1W",
    date: "8 November 2026",
    category: "GLOBAL_MACRO",
    source: "Contoh skenario transmisi kebijakan",
    summary: "Gangguan jalur pelayaran energi internasional memicu premi risiko geopolitik baru, mendorong harga minyak mentah Brent naik 3,8% dalam sepekan. Hal ini memicu kekhawatiran beban impor energi namun memberikan dorongan laba bagi emiten eksplorasi migas.",
    catalyst: "Ketegangan geopolitik jalur pasokan dan risiko logistik maritim",
    marketSentiment: "NEUTRAL",
    overallImpact: "Tekanan inflasi energi impor bagi emiten manufaktur, tetapi memberikan kenaikan pendapatan bagi emiten hulu migas.",
    sectorImpacts: [
      {
        sector: "Minyak dan gas bumi",
        sentiment: "BULLISH",
        tickers: ["MEDC", "ENRG", "ELSA"],
        impactDescription: "Peningkatan rata-rata harga jual minyak dan gas langsung mendongkrak margin operasional dan arus kas."
      },
      {
        sector: "Barang konsumsi dan manufaktur",
        sentiment: "BEARISH",
        tickers: ["ICBP", "INDF", "MYOR"],
        impactDescription: "Risiko peningkatan biaya logistik kemasan turunan petrokimia dan distribusi bahan baku impor."
      }
    ]
  },
  {
    id: "news-w3",
    title: "Diskusi kebijakan penyesuaian tarif pajak pertambahan nilai: Sektor ritel bersikap menunggu dan mengamati",
    period: "1W",
    date: "6 November 2026",
    category: "DOMESTIC_POLITICS",
    source: "Contoh skenario transmisi kebijakan",
    summary: "Pemerintah dan pembuat kebijakan mengkaji mitigasi dampak penyesuaian tarif pajak pertambahan nilai terhadap daya beli masyarakat kelas menengah, termasuk wacana insentif khusus pada bahan pokok agar tidak menekan laju konsumsi domestik.",
    catalyst: "Regulasi fiskal domestik dan penataan kebijakan tarif pajak",
    marketSentiment: "BEARISH",
    overallImpact: "Sikap menunggu dan mengamati menyelimuti sektor ritel modern dan otomotif karena konsumen menahan belanja sekunder.",
    sectorImpacts: [
      {
        sector: "Ritel modern dan gaya hidup",
        sentiment: "BEARISH",
        tickers: ["ACES", "MAPI", "ERAA"],
        impactDescription: "Konsumen kelas menengah cenderung menunda belanja barang non-esensial dan perangkat elektronik."
      },
      {
        sector: "Barang konsumsi primer",
        sentiment: "BULLISH",
        tickers: ["ICBP", "INDF", "AMRT"],
        impactDescription: "Karakteristik defensif barang kebutuhan pokok makanan dan minimarket membuat arus modal beralih ke emiten ini."
      }
    ]
  },
  {
    id: "news-w4",
    title: "Pengetatan izin pembangunan fasilitas pengolahan nikel: Pasokan terkendali menopang harga logam industri",
    period: "1W",
    date: "4 November 2026",
    category: "COMMODITIES",
    source: "Contoh skenario transmisi kebijakan",
    summary: "Otoritas terkait menegaskan pembatasan izin baru untuk fasilitas pengolahan nikel kelas rendah demi menjaga ketahanan cadangan bijih nikel dan mendorong hilirisasi produk bernilai tambah tinggi untuk rantai pasok baterai kendaraan listrik.",
    catalyst: "Kebijakan tata kelola hilirisasi mineral nasional",
    marketSentiment: "BULLISH",
    overallImpact: "Mencegah kelebihan pasokan nikel dunia berlanjut, menahan pelemahan harga acuan nikel di pasar komoditas internasional.",
    sectorImpacts: [
      {
        sector: "Pertambangan nikel dan mineral",
        sentiment: "BULLISH",
        tickers: ["ANTM", "INCO", "NCKL", "MBMA"],
        impactDescription: "Harga jual bijih nikel domestik diproyeksikan stabil, profitabilitas penambang bijih nikel terlindungi."
      }
    ]
  },

  // --- BULANAN (1 BULAN TERAKHIR) ---
  {
    id: "news-m1",
    title: "Arah prioritas anggaran belanja negara: Ketahanan pangan, swasembada energi, dan efisiensi BUMN",
    period: "1M",
    date: "Oktober – November 2026",
    category: "DOMESTIC_POLITICS",
    source: "Contoh skenario transmisi kebijakan",
    summary: "Konsolidasi program kerja memperlihatkan alokasi anggaran belanja pada sektor pangan, energi terbarukan, serta dorongan efisiensi dividen BUMN. Sektor perkebunan, logistik pendukung, dan perbankan penyalur program menjadi penerima manfaat langsung belanja negara.",
    catalyst: "Arah belanja anggaran pendapatan dan belanja negara",
    marketSentiment: "BULLISH",
    overallImpact: "Peluang pertumbuhan struktural jangka panjang untuk emiten BUMN berkinerja stabil serta industri agribisnis pendukung.",
    sectorImpacts: [
      {
        sector: "Perbankan BUMN",
        sentiment: "BULLISH",
        tickers: ["BBRI", "BMRI", "BBNI"],
        impactDescription: "Penyaluran kredit program prioritas dan stabilitas pembagian dividen berkala untuk setoran kas negara."
      },
      {
        sector: "Pertanian dan perkebunan",
        sentiment: "BULLISH",
        tickers: ["TAPG", "DSNG", "SIMP"],
        impactDescription: "Program bauran bahan bakar nabati memperkuat serapan minyak sawit mentah di pasar dalam negeri."
      },
      {
        sector: "Semen dan bahan bangunan",
        sentiment: "NEUTRAL",
        tickers: ["SMGR", "INTP"],
        impactDescription: "Fokus anggaran bergeser ke program perlindungan sosial dan fasilitas pedesaan sehingga serapan proyek infrastruktur stabil melandai."
      }
    ]
  },
  {
    id: "news-m2",
    title: "Perkembangan kebijakan perdagangan global: Potensi relokasi industri manufaktur ke kawasan Asia Tenggara",
    period: "1M",
    date: "Oktober – November 2026",
    category: "GLOBAL_MACRO",
    source: "Contoh skenario transmisi kebijakan",
    summary: "Dinamika kebijakan perdagangan internasional meningkatkan ketidakpastian arus ekspor langsung, namun Indonesia berpeluang menjadi tujuan diversifikasi rantai pasok industri global bagi fasilitas manufaktur yang merelokasi operasinya.",
    catalyst: "Kebijakan tarif dan proteksionisme perdagangan internasional",
    marketSentiment: "NEUTRAL",
    overallImpact: "Volatilitas indeks saham kawasan meningkat, namun pengembang kawasan industri berpeluang mencatat kenaikan permintaan lahan pabrik.",
    sectorImpacts: [
      {
        sector: "Kawasan industri",
        sentiment: "BULLISH",
        tickers: ["DMAS", "SSIA", "BEST"],
        impactDescription: "Peningkatan minat investasi pabrik manufaktur dan pusat data internasional yang mendiversifikasi fasilitas pabrik."
      },
      {
        sector: "Otomotif dan komponen",
        sentiment: "BEARISH",
        tickers: ["ASII", "AUTO"],
        impactDescription: "Persaingan harga meningkat dari masuknya kendaraan listrik impor yang mencari pasar alternatif di Asia Tenggara."
      }
    ]
  },
  {
    id: "news-m3",
    title: "Musim laporan keuangan kuartal III: Laba perbankan solid dan arus kas emiten energi terjaga",
    period: "1M",
    date: "Oktober – November 2026",
    category: "DOMESTIC_POLITICS",
    source: "Contoh skenario transmisi kebijakan",
    summary: "Rangkuman laba kuartal III 2026 mencatat bank-bank tier-1 membukukan kenaikan laba bersih berkat terjaganya kualitas aset dan efisiensi biaya kredit. Sementara emiten komoditas energi membukukan posisi kas yang memadai untuk dividen interim.",
    catalyst: "Kinerja laba bersih kuartalan dan prospek dividen",
    marketSentiment: "BULLISH",
    overallImpact: "Memicu perburuan dividen menjelang penutupan tahun buku pada emiten dengan tingkat imbal hasil dividen menarik.",
    sectorImpacts: [
      {
        sector: "Energi dan batubara",
        sentiment: "BULLISH",
        tickers: ["ADRO", "PTBA", "ITMG"],
        impactDescription: "Imbal hasil dividen berkala di kisaran 8–14% menjadi penopang valuasi saham saat terjadi fluktuasi harga komoditas."
      },
      {
        sector: "Telekomunikasi",
        sentiment: "NEUTRAL",
        tickers: ["TLKM", "ISAT", "EXCL"],
        impactDescription: "Pertumbuhan pendapatan per pengguna stabil, namun alokasi belanja modal jaringan serat optik tetap membutuhkan pendanaan berkelanjutan."
      }
    ]
  },
  {
    id: "news-m4",
    title: "Arus dana investor asing bulanan: Akumulasi beli bersih tercatat Rp 4,8 triliun setelah periode arus keluar",
    period: "1M",
    date: "Oktober – November 2026",
    category: "MONETARY_CURRENCY",
    source: "Contoh skenario transmisi kebijakan",
    summary: "Investor institusi asing mencatatkan akumulasi beli bersih sebesar Rp 4,8 triliun di pasar reguler. Valuasi saham IDX yang berada di area diskon dengan rasio P/E berjalan 13,2x dibandingkan rerata 5 tahun sebesar 15,5x mendorong masuknya kembali dana global.",
    catalyst: "Valuasi komparatif saham domestik dan penyeimbangan portofolio global",
    marketSentiment: "BULLISH",
    overallImpact: "Indeks saham bertahan di atas level psikologis 7.300 dengan rata-rata transaksi harian mencapai Rp 11,5 triliun.",
    sectorImpacts: [
      {
        sector: "Saham berkapitalisasi besar",
        sentiment: "BULLISH",
        tickers: ["BBCA", "BMRI", "ASII", "TLKM", "BBRI"],
        impactDescription: "Menjadi pilihan utama akumulasi portofolio investor institusi, menopang pergerakan saham berbobot terbesar."
      }
    ]
  }
];
