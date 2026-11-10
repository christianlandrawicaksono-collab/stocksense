# 📈 StocksSense — Indonesian Stock & Macro Intelligence Terminal

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**StocksSense** adalah terminal intelijen pasar modern untuk Bursa Efek Indonesia (IHSG). Berbeda dari dasbor saham konvensional, StocksSense menghubungkan **kebijakan politik dalam negeri, dinamika geopolitik global, dan data moneter makro** secara langsung dengan **transmisi dampaknya ke sektor serta emiten saham IDX**.

Dilengkapi dengan simulator strategi investasi (DCA vs Lump-sum), visualisasi valuasi historis (*P/E Standard Deviation Bands*), dan asisten intelijen pasar berbasis AI.

---

## 🌟 Fitur Utama (Core Modules)

### 1. 🌐 Macro & Geopolitical Radar
* **Timeframe Switcher:** Toggle antara **1 Minggu (Weekly Flash)** dan **1 Bulan (Monthly Macro Review)**.
* **Filter Topik Terintegrasi:** 
  * Geopolitik & Makro Global (The Fed, konflik regional, harga minyak mentah Brent).
  * Politik & Regulasi Domestik (Kebijakan kabinet, PPN, belanja APBN, program prioritas).
  * Moneter & Nilai Tukar (BI-Rate, DXY vs Rupiah, arus dana investor asing/foreign flow).
  * Komoditas & Hilirisasi (Tata kelola smelter nikel, batubara Newcastle, CPO).
* **Transmission Impact Matrix:** Setiap berita langsung memetakan:
  * Katalis utama & sentimen (*Bullish / Bearish / Neutral*).
  * Sektor dan kode emiten yang terdampak (misal: `BBCA`, `BBRI`, `ASII`, `ADRO`, `MEDC`, `ICBP`).
  * Alasan finansial logis mengapa saham tersebut terpengaruh.

### 2. 📊 Strategy & DCA Simulator (Backtest Interaktif)
* **Simulasi Nabung Rutin (Dollar Cost Averaging / DCA)** vs **Lump-sum**.
* **Dividend Reinvestment Plan (DRIP / Snowball Effect):** Otomatis membelikan dividen yang cair ke saham tambahan.
* **Metrik Finansial Komprehensif:**
  * Total Modal Disetor vs Nilai Portofolio Akhir.
  * Keuntungan Bersih (Rp & %).
  * **CAGR** (Laju Pertumbuhan Majemuk Tahunan).
  * **Max Drawdown (MDD)** (Tingkat penurunan terdalam dari puncak).
  * **Alpha vs IHSG** (Berapa persen strategi ini mengalahkan atau di bawah indeks acuan IHSG).
* **Grafik Interaktif:** Visualisasi kurva nilai portofolio vs modal vs IHSG dengan crosshair tooltip.

### 3. 📐 P/E Historical Valuation Bands & Fair Value
* Menampilkan garis deviasi valuasi historis 5 tahun:
  * $+2\sigma$ *(Overvalued / Sangat Mahal)*
  * $+1\sigma$ *(Di atas rerata)*
  * **Mean** *(Harga Wajar Historis)*
  * $-1\sigma$ *(Undervalued / Area Akumulasi)*
  * $-2\sigma$ *(Deep Value / Diskon Ekstrim)*
* **Diagnosis Valuasi Otomatis:** Menilai apakah saham sedang berada di area diskon atau rawan koreksi.
* **Kalkulasi Harga Wajar:** Target harga rata-rata historis & formula **Benjamin Graham Number** ($\sqrt{22.5 \times \text{EPS} \times \text{BVPS}}$).
* Matriks kekuatan fundamental dan risiko utama emiten.

### 4. 🔍 IDX Stock Screener
* Filter cepat saham IDX berdasarkan preset:
  * 💰 *High Dividend Aristocrats* (Yield > 5%)
  * 🏷️ *Undervalued Bluechips* (P/E < 12x)
  * 🔥 *High Profitability* (ROE > 18%)
  * 🛡️ *Healthy Balance Sheet* (DER < 1.0x)
* Tabel responsif dengan fitur sorting multi-kolom dan tombol shortcut ke simulator & valuasi.

### 5. 🤖 StocksSense AI Market Assistant
* Asisten intelijen pasar yang siap menganalisis skenario: *"Apa dampak lonjakan minyak mentah ke MEDC dan ICBP?"* atau *"Bagaimana transmisi kenaikan PPN ke sektor ritel?"*
* Dilengkapi dengan mesin analisis finansial terintegrasi (*zero-configuration*) dan slot opsi untuk memasukkan **Google Gemini API Key** secara langsung.

---

## 🛠️ Tech Stack & Arsitektur

* **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Turbopack)
* **Bahasa:** [TypeScript](https://www.typescriptlang.org/)
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
* **Ikon:** [Lucide React](https://lucide.dev/)
* **Desain UI:** High-density dark terminal aesthetic (Zinc, Obsidian `#070b13`, Emerald `#10b981`, Rose `#f43f5e`, Amber `#f59e0b`).

```
stocksense/
├── src/
│   ├── app/
│   │   ├── globals.css         # Styling global & dark terminal tokens
│   │   ├── layout.tsx          # Root layout & font definition
│   │   └── page.tsx            # Main application orchestrator
│   ├── components/
│   │   ├── ai/
│   │   │   └── GeminiAiModal.tsx       # Modal AI Market Intelligence
│   │   ├── layout/
│   │   │   ├── Navbar.tsx              # Navigasi & switch modul
│   │   │   └── MarketTicker.tsx        # Ticker tape IHSG, USD/IDR, Komoditas
│   │   ├── macro/
│   │   │   └── MacroRadarView.tsx      # News feed & sector impact matrix
│   │   ├── screener/
│   │   │   └── StockScreenerView.tsx   # Filterable IDX stock table
│   │   ├── simulator/
│   │   │   └── StrategySimulator.tsx   # DCA simulator & visual curve chart
│   │   └── valuation/
│   │       └── ValuationBandView.tsx   # P/E standard deviation bands
│   ├── data/
│   │   ├── macroData.ts        # Dataset intelijen makro, politik & komoditas
│   │   └── stocksData.ts       # Metrik fundamental & data historis bulanan 2020-2026
│   └── types/
│       └── market.ts           # Definisi interface TypeScript
└── package.json
```

---

## 🚀 Cara Menjalankan Secara Lokal

Pastikan kamu sudah memiliki [Node.js](https://nodejs.org/) (v18.17+ atau v20+) di komputer kamu.

1. **Clone repository ini:**
   ```bash
   git clone https://github.com/USERNAME_KAMU/stocksense.git
   cd stocksense
   ```

2. **Instal dependensi:**
   ```bash
   npm install
   ```

3. **Jalankan development server:**
   ```bash
   npm run dev
   ```

4. **Buka di browser:**
   Akses `http://localhost:3000` di peramban favoritmu.

---

## 📝 Disclaimer
Proyek ini dibuat untuk keperluan edukasi, riset, simulasi strategi investasi, dan portofolio pengembangan perangkat lunak. Konten dan data yang disajikan bukan merupakan anjuran transaksi beli/jual sekuritas atau nasihat keuangan berlisensi.

---

## 👨‍💻 Kontributor & Lisensi
Dilisensikan di bawah [MIT License](LICENSE).
Dikembangkan untuk komunitas investor dan pengembang teknologi pasar modal Indonesia.
