# 📈 StocksSense — Indonesian Stock & Global Macro Intelligence Terminal

> 🌐 [English](README.md) | **Bahasa Indonesia**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Three.js](https://img.shields.io/badge/Three.js-3D_Globe-000000?style=for-the-badge&logo=threedotjs)](https://threejs.org/)
[![Vitest](https://img.shields.io/badge/Vitest-84_Tests-6E9F18?style=for-the-badge&logo=vitest)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**StocksSense** adalah platform riset saham Indonesia (BEI/IHSG) dan intelijen makro global berbasis web yang memadukan **warta pasar modal real-time**, **peta bola dunia 3D interaktif**, **analitik teknikal-fundamental berdensitas tinggi**, serta **asisten riset Gemini AI** dalam satu aplikasi **Dual-Mode** yang terisolasi bersih:

1. **Mode Berita (Editorial Broadsheet — Light Theme `#FBFBFA`):** Pengalaman membaca berita pasar modal bergaya koran finansial modern dengan agregasi RSS multi-sumber 3 hari, ringkasan **AI Market Brief**, pratinjau cepat, bookmark tersimpan, dan tautan ticker langsung ke Terminal.
2. **Mode Terminal (Unified Obsidian Workstation — Dark Theme `#080A0F`):** Satu ruang kerja top-down terpadu bergaya Matte Obsidian + StocksSense Teal yang menyatukan **3D Interactive World Globe (Three.js)**, **Ikhtisar Pasar BEI**, dan **Workstation Riset Saham BEI** dengan **Dual Parallax Mapping**.

---

## 🌟 Fitur Utama

### 1. 🌍 Unified Terminal: 3D World Globe + Ikhtisar BEI + Riset Saham
* **3D Interactive World Globe (Three.js + PBR Relief):**
  * Memantau **10 pusat pasar global** (`ID`, `US`, `JP`, `HK`, `SG`, `KR`, `CN`, `UK`, `DE`, `AU`) beserta indeks utama dan **40 saham blue-chip live** (`NVDA`, `AAPL`, `Toyota`, `Tencent`, `DBS`, `Samsung`, `AstraZeneca`, `SAP`, `BHP`, `BBCA`, `BMRI`, dll.) dengan normalisasi mata uang lokal (`IDR`, `USD`, `JPY`, `HKD`, `SGD`, `KRW`, `CNY`, `GBP`, `EUR`, `AUD`).
  * Tekstur bumi prosedural lokal dari poligon geografis asli `world-atlas` (*albedo + night-lights*, *topography bump-relief*, *ocean roughness*), atmosfer Fresnel teal, highlight poligon negara aktif, *animated 3D capital-flow arcs* ke Jakarta (`IDX`), status jam bursa real-time lintas timezone, *smooth fly-to*, anti-overlap pin labels, dan auto-pause GPU (`IntersectionObserver`).
* **Dual Parallax Mapping:**
  * **Scroll-Linked Parallax Curtain (`framer-motion` `useScroll` + `useTransform`):** Saat menggulir dari Radar Global 3D ke Workstation Riset BEI, globe mundur halus disertai *scroll-coupled camera pitch* sementara lembar riset BEI naik dan terkunci stabil untuk analisis angka.
  * **3D Surface Relief & Pointer Parallax:** Efek relief permukaan kontinen dan pergeseran kedalaman kamera/starfield mengikuti kursor.
* **Ikhtisar Pasar BEI Terpadu:**
  * Panel ringkasan denyut BEI (`Naik/Turun`, `Sektor Kuat`, `Sinyal Area Beli`), **Sector Heatmap BEI** 1-klik, **Top Movers** (`Naik` / `Turun` / `Area Beli`), dan **Kurva Performa Relatif** (`IHSG` vs `S&P 500`, `Gold`, `Brent`).
* **Workstation Riset Saham BEI:**
  * **5-Pillar Stock Health Ribbon:** 5 kartu kesehatan interaktif (**Valuasi P/E**, **Profitabilitas ROE**, **Struktur DER** sadar sektor perbankan, **Dividen Yield**, dan **Target Beli**) yang terhubung langsung ke tab analisis/editor target.
  * **Grafik Interaktif (`lightweight-charts` v5):** Mode `Lilin` (*candlestick*) & `Garis`, rentang `1Bl`–`Semua`, overlay `MA20`, `MA50`, `RSI`, `Volume`, penanda dividen, serta garis **Harga Wajar** & **Target Beli**.
  * **Valuasi P/E & Interactive Valuation Gauge Arc:** Meteran deviasi P/E interaktif (`-2 SD` s.d. `+2 SD`) dengan simulasi *implied price* & upside/downside, tabel pita deviasi (kurasi maupun estimasi dinamis 5 tahun untuk emiten kustom BEI), dan Nilai Intrinsik **Benjamin Graham**.
  * **Simulasi Strategi DCA & Lump-Sum:** Backtest kuartalan berbasis riwayat Yahoo Finance nyata (penyesuaian *stock split* + opsi **DRIP**) dibandingkan IHSG.
  * **Multi-Saham Compare & Alokasi Modal Watchlist:** Perbandingan head-to-head kurva relatif & rasio fundamental, serta kalkulator alokasi lot BEI, proyeksi dividen, dan keseimbangan sektor.
  * **Quick Research Rail & Watchlist Screener:** Slider anggaran interaktif (`Rp 1 Jt – 100 Jt`) dengan proyeksi nilai terhadap Harga Wajar/Target Beli, Watchlist kustom hingga 15 saham BEI (tersimpan di `localStorage` dengan target beli, catatan pribadi, serta ekspor/impor backup JSON).

### 2. ⌨️ Navigasi & Pintasan Keyboard Terminal
* **Top Sub-Bar & Persistent Bottom Utility Dock:** Toggle cepat panel, Workspace Presets (`Fokus` / `Standar` / `Penuh`), telemetri ticker aktif, dan auto-offset dock saat panel AI terbuka.
* **Global Command Search (`S` atau `⌘K` / `Ctrl+K`):** Pencarian instan seluruh emiten BEI (termasuk live search Yahoo Finance) dengan filter `Semua` / `Watchlist` / `Kurasi`, mini sparkline SVG, P/E, dan navigasi keyboard (`↑`/`↓`/`Enter`/`Esc`).
* **Pintasan Cepat:**
  * `S` atau `⌘K` / `Ctrl+K` — Buka Command Search emiten
  * `G` — Lipat / buka Radar Global 3D & Ikhtisar BEI
  * `[` — Tampilkan / sembunyikan Watchlist
  * `]` — Tampilkan / sembunyikan Panel Lot & Target (Quick Rail)
  * `F` — Toggle mode Fokus Chart penuh

### 3. 📰 Mode Berita (Editorial Broadsheet)
* **Agregasi RSS Pasar Modal Multi-Sumber (3 Hari Terakhir):** Pengelompokan kategori, deteksi ticker BEI otomatis, filter Watchlist & kategori, bookmark artikel, reading progress, dan *hover preview*.
* **AI Market Brief:** Ringkasan makro & implikasi sektoral harian yang dapat di-generate sesuai berita terbaru dan isi Watchlist pengguna.
* **Isolasi Tema & Bundle:** Berjalan di tema kertas terang `#FBFBFA` tanpa memuat chunk Three.js maupun permintaan `/api/global-markets`.

### 4. 🤖 Asisten Konsultasi Gemini AI
* Side panel konsultasi kontekstual (`POST /api/ai/analyze`) yang otomatis membaca saham aktif, metrik valuasi, Watchlist, berita terkait, alokasi portofolio, hingga sentimen bursa negara dari 3D Globe (*"Bedah Dampak Pasar Negara ke IHSG"*).
* Mendukung kunci API server (`GEMINI_API_KEY`) maupun kunci pribadi (BYOK) di browser.

---

## 🛠️ Tech Stack & Arsitektur

* **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Cache Components `"use cache"`, Webpack production build)
* **Runtime & Language:** [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/)
* **Styling & Motion:** [Tailwind CSS v4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/), [Lucide Icons](https://lucide.dev/)
* **Visualisasi 3D & Grafik:** [Three.js](https://threejs.org/) (`world-atlas` + `topojson-client`), [TradingView Lightweight Charts v5](https://tradingview.github.io/lightweight-charts/)
* **Data Pasar & Berita:** [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) + Multi-source RSS server parser + Google Gemini API
* **Pengujian:** [Vitest](https://vitest.dev/) (`84` unit tests pada `19` file uji)
* **Tipografi & Lokalisasi:** *Literata*, *IBM Plex Sans*, *IBM Plex Mono* (`tabular-nums`), format angka standar Indonesia (`id-ID`) melalui [src/lib/format.ts](src/lib/format.ts).

```text
stocksense/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/analyze/route.ts         # Konsultasi Gemini AI kontekstual
│   │   │   ├── global-markets/route.ts     # Snapshot 10 bursa global + 40 blue chips
│   │   │   ├── history/[ticker]/route.ts   # Riwayat OHLCV & dividen (Yahoo / ilustrasi)
│   │   │   ├── macro/route.ts              # Indikator makro (IHSG, USD/IDR, S&P500, Gold, Brent)
│   │   │   ├── news/route.ts               # Agregasi RSS pasar modal 3 hari
│   │   │   ├── news/brief/route.ts         # Ringkasan AI Market Brief
│   │   │   ├── quotes/route.ts             # Batch live quotes emiten BEI
│   │   │   └── stocks/                     # Profil fundamental & pencarian emiten BEI
│   │   ├── page.tsx                        # Orkestrator Dual-Mode (Unified Terminal & Berita)
│   │   └── terminal/page.tsx               # Permalink redirect ke Mode Terminal
│   ├── components/
│   │   ├── ai/GeminiAiModal.tsx            # Side panel asisten analisis Gemini AI
│   │   ├── layout/                         # Navbar & MarketTicker makro
│   │   ├── news/                           # Editorial Broadsheet, AI Brief, Reader Drawer, Dock
│   │   └── terminal/
│   │       ├── WorldGlobe3D.tsx            # 3D Interactive World Globe (Three.js + PBR)
│   │       ├── UnifiedGlobalCommandDeck.tsx# Command Deck 3D + Ikhtisar BEI + Scroll Parallax
│   │       ├── TerminalTopBar.tsx          # Top Sub-Bar & Workspace Layout Presets
│   │       ├── TerminalBottomDock.tsx      # Persistent Bottom Utility Dock
│   │       ├── TerminalCommandSearch.tsx   # Modal Command Search (S / ⌘K)
│   │       ├── TerminalMainPane.tsx        # Header harga, chart, tab Valuasi/DCA/Profil/Berita
│   │       ├── StockHealthRibbon.tsx       # 5 pilar kesehatan saham interaktif
│   │       ├── ValuationGaugeArc.tsx       # Busur deviasi P/E interaktif (-2 SD..+2 SD)
│   │       ├── LightweightPriceChart.tsx   # Grafik Candlestick/Line + indikator teknikal
│   │       ├── QuickResearchRail.tsx       # Slider anggaran lot BEI & proyeksi harga wajar
│   │       ├── TerminalWatchlist.tsx       # Watchlist, screener, alert target & backup JSON
│   │       ├── MarketOverviewPane.tsx      # Heatmap sektor BEI, Top Movers & Kurva Relatif
│   │       ├── StockCompareTab.tsx         # Perbandingan multi-saham head-to-head
│   │       └── StockAllocationTab.tsx      # Simulasi alokasi modal & lot Watchlist
│   ├── hooks/                              # useMarketData, useGlobalMarkets, useLiveNews, useAiChat
│   ├── data/                               # Dataset kurasi BEI & makro fallback
│   └── lib/                                # Cache Yahoo, market hours, valuasi, global markets & __tests__/
└── package.json
```

---

## 🚀 Cara Menjalankan Secara Lokal

Pastikan Anda telah memasang [Node.js](https://nodejs.org/) **v22+** (atau v20+).

1. **Clone repository & instal dependensi:**
   ```bash
   git clone https://github.com/christianlandrawicaksono-collab/stocksense.git
   cd stocksense
   npm install
   ```

2. **Konfigurasi Environment Variables (opsional, buat file `.env.local`):**
   ```env
   # Gunakan "yahoo" untuk data pasar live & RSS berita, atau "illustrative" untuk mode data ilustrasi lokal
   MARKET_DATA_PROVIDER=yahoo

   # Opsional: kunci Google Gemini API untuk fitur AI Analis & AI Market Brief
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3-flash-preview
   ```
   > Tanpa `.env.local`, aplikasi tetap berjalan mulus dalam mode `illustrative` menggunakan dataset acuan bawaan, dan pengguna tetap bisa memasukkan kunci Gemini pribadi langsung dari panel AI.

3. **Jalankan development server:**
   ```bash
   npm run dev
   ```
   Buka `http://localhost:3000` (Mode Berita) atau `http://localhost:3000/?mode=terminal` (Unified Terminal 3D).

4. **Verifikasi Test, Lint, dan Production Build:**
   ```bash
   npm test
   npx eslint src
   npm run build
   ```

---

## ⚖️ Integritas Data & Disclaimer

1. **Sumber Data Transparan:** Saat `MARKET_DATA_PROVIDER=yahoo` aktif, harga saham BEI, indeks global, dan saham unggulan negara lain bersumber dari **Yahoo Finance** (~10–15 menit tertunda sesuai bursa) dengan cache server terkelola, serta berita dari umpan **RSS pasar modal**. Bila penyedia eksternal tidak tersedia atau mode `illustrative` dipakai, aplikasi secara eksplisit menampilkan label **Ilustrasi / Data Acuan**.
2. **Bukan Rekomendasi Finansial:** Seluruh visualisasi, metrik valuasi, simulasi DCA/lot, serta analisis AI pada platform ini ditujukan untuk **riset dan edukasi pasar modal**, bukan anjuran transaksi beli/jual saham atau nasihat keuangan berlisensi.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).
