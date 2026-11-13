# 📈 StocksSense — Indonesian Stock & Macro Intelligence Terminal

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**StocksSense** adalah platform intelijen pasar saham Indonesia (IHSG) yang menghubungkan **kebijakan moneter makro, dinamika geopolitik global, dan regulasi domestik** secara langsung ke **transmisi dampaknya terhadap sektor serta emiten saham Bursa Efek Indonesia (IDX)**.

Aplikasi ini mengusung arsitektur **Dual-Mode terpadu**:
1. **Mode Berita (Editorial Broadsheet):** Pengalaman membaca bergaya koran finansial dengan tata letak terang penuh (*full-light*), tipografi *Literata* dan *IBM Plex Sans*, serta navigasi kontekstual langsung ke analisis saham.
2. **Mode Terminal (Dark Analytics):** Lingkungan analisis teknikal dan fundamental dengan tema gelap berdensitas tinggi, grafik harga kuartalan, valuasi pita P/E historis, simulator investasi berkala (DCA), dan penyaring saham terpadu.

---

## 🌟 Fitur Utama

### 1. 📰 Mode Berita (Editorial Broadsheet)
* **Desain Koran Finansial Klasik:** Latar terang penuh (`#FBFBFA`) dengan pembatas garis tipis (*hairline borders* `#E5E5DC`), menghindari kartu dan bayangan berlebih.
* **Transmisi Makro ke Emiten:** Setiap skenario berita menganalisis katalis, sentimen pasar (*positif / negatif / netral*), dan emiten IDX terkait (`BBCA`, `BBRI`, `BMRI`, `ASII`, `ADRO`, `ANTM`, `MEDC`, `ICBP`, `TLKM`).
* **Integrasi Ticker Kontekstual:** Mengetuk kode ticker pada artikel berita langsung membuka emiten tersebut di Mode Terminal dengan panel asal berita tersemat.
* **Ringkasan Pasar & Warta Terkurasi:** Menampilkan tinjauan makro mingguan dan penomoran skenario terstruktur.

### 2. 💻 Mode Terminal (Analisis & Intelijen Pasar)
* **Grafik Harga Kuartalan Murni:** Visualisasi garis harga penutupan (2020–2026) dengan label sumbu terformat rapi, penanda titik dividen tunai, dan tooltip interaktif.
* **Valuasi Historis Pita P/E (P/E Deviation Bands):**
  * Garis deviasi statistik: $+2\sigma$ *(Mahal ekstrim)*, $+1\sigma$ *(Di atas rerata)*, **Mean** *(Wajar historis)*, $-1\sigma$ *(Area undervalued)*, dan $-2\sigma$ *(Diskon ekstrim)*.
  * Diagnosis valuasi otomatis berdasarkan EPS terkini emiten.
  * Formula Nilai Intrinsik **Benjamin Graham** ($\sqrt{22,5 \times \text{EPS} \times \text{BVPS}}$) beserta catatan relevansi sektor perbankan dan saham bertumbuh.
* **Simulator Strategi Investasi (DCA Kuartalan & Lump-sum):**
  * Simulasi akumulasi berkala kuartalan yang selaras dengan frekuensi laporan keuangan.
  * Opsi **Reinvestasi Dividen (DRIP)** untuk melihat efek bunga berbunga (*compounding*).
  * Metrik komprehensif: Modal disetor, nilai portofolio akhir, keuntungan bersih (Rp & %), pertumbuhan tahunan sederhana, dan perbandingan terhadap indeks acuan.
* **Daftar Pantau & Penyaring Terpadu (Watchlist & Screener):**
  * Pencarian emiten instan berdasarkan kode, nama, atau sektor.
  * Preset filter cepat: *Dividen > 5%*, *P/E < 12x*, *ROE > 18%*, dan *DER < 1,0x*.
  * Fitur pengurutan multi-kolom (*sorting*) berbasis angka.

### 3. 📱 Optimasi Layar Sentuh & Ponsel (Mobile First)
* **Target Sentuh Ergonomis:** Seluruh tombol dan baris interaktif memiliki tinggi minimal 44px (`min-h-[44px]`).
* **Alur Dua Arah:** Mengetuk saham di daftar pantau otomatis menggulir (*smooth scroll*) ke grafik di HP, dilengkapi tombol *"Ganti saham"* untuk kembali ke daftar.
* **Panel Ticker Bersih:** Ticker bar dioptimalkan untuk desktop dan disembunyikan di layar HP guna memaksimalkan ruang kerja analisis.

### 4. 🤖 Asisten Konsultasi AI Terintegrasi
* Modal analisis skenario makro berbasis kecerdasan buatan untuk menguji dampak kebijakan ekonomi terhadap portofolio saham IDX.
* Mendukung integrasi opsional dengan Google Gemini API.

---

## 🛠️ Arsitektur & Tech Stack

* **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
* **Runtime:** [React 19](https://react.dev/)
* **Bahasa:** [TypeScript 5](https://www.typescriptlang.org/)
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
* **Tipografi:**
  * **Literata:** Judul editorial Mode Berita.
  * **IBM Plex Sans:** Teks isi, label UI, dan navigasi.
  * **IBM Plex Mono:** Kode ticker dan angka tabel tabular (*tabular-nums*).
* **Format Angka:** Standar baku Indonesia (`id-ID`) via helper terpusat `src/lib/format.ts` (desimal koma `14,5%`, pemisah ribuan titik `Rp 10.000`).

```
stocksense/
├── src/
│   ├── app/
│   │   ├── globals.css             # Desain token, tema, dan utilitas tipografi
│   │   ├── layout.tsx              # Root layout & pemuatan font Web Google
│   │   ├── page.tsx                # Orkestrator utama (sinkronisasi state URL & responsif)
│   │   └── terminal/page.tsx       # Rute redirect permalink terminal
│   ├── components/
│   │   ├── ai/
│   │   │   └── GeminiAiModal.tsx   # Modal asisten intelijen pasar AI
│   │   ├── layout/
│   │   │   ├── Navbar.tsx          # Navigasi utama dengan toggle Berita/Terminal
│   │   │   └── MarketTicker.tsx    # Bar indikator makro acuan
│   │   ├── news/
│   │   │   └── NewsView.tsx        # Tampilan Mode Berita gaya editorial broadsheet
│   │   └── terminal/
│   │       ├── TerminalMainPane.tsx    # Grafik harga, P/E band, simulator DCA & profil emiten
│   │       └── TerminalWatchlist.tsx   # Daftar pantau & penyaring saham terpadu
│   ├── data/
│   │   ├── macroData.ts            # Skenario makro, katalis, dan pemetaan emiten
│   │   └── stocksData.ts           # Data fundamental & historis kuartalan 2020-2026
│   ├── lib/
│   │   └── format.ts               # Formatter id-ID (formatRupiah, formatPersen, formatNumber)
│   └── types/
│       └── market.ts               # Interface TypeScript untuk emiten, berita & simulasi
└── package.json
```

---

## 🚀 Cara Menjalankan Secara Lokal

Pastikan Anda telah memasang [Node.js](https://nodejs.org/) (v18.17+ atau v20+) pada komputer Anda.

1. **Clone repository:**
   ```bash
   git clone https://github.com/christianlandrawicaksono-collab/stocksense.git
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

4. **Buka di peramban:**
   Buka `http://localhost:3000` pada peramban Anda.

5. **Pengujian Build & Lint:**
   ```bash
   npm run lint
   npm run build
   ```

---

## ⚖️ Integritas Data & Disclaimer

1. **Data Ilustrasi:** Seluruh data historis harga penutupan, rasio finansial, dan skenario berita makroekonomi yang terdapat pada repositori ini merupakan **data historis terkurasi kuartalan dan data ilustrasi** yang disusun untuk keperluan riset antarmuka pengguna, pengujian fungsionalitas visualisasi finansial, serta simulasi strategi investasi berkala.
2. **Bukan Rekomendasi Finansial:** Konten pada platform ini bukan merupakan anjuran transaksi beli/jual saham, nasihat keuangan berlisensi, maupun data pasar seketika (*real-time live market feed*).
3. **Penyajian Transparan:** Seluruh metrik kalkulasi disajikan secara transparan dengan keterangan frekuensi data sebenarnya tanpa klaim performa yang menyesatkan.

---

## 📄 Lisensi
Proyek ini dilisensikan di bawah [MIT License](LICENSE).
