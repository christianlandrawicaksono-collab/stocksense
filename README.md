# 📈 StocksSense — Indonesian Stock & Global Macro Intelligence Terminal

> 🌐 **English** | [Bahasa Indonesia](README.id.md)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Three.js](https://img.shields.io/badge/Three.js-3D_Globe-000000?style=for-the-badge&logo=threedotjs)](https://threejs.org/)
[![Vitest](https://img.shields.io/badge/Vitest-84_Tests-6E9F18?style=for-the-badge&logo=vitest)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**StocksSense** is an Indonesian stock market (IDX / IHSG) and global macro intelligence web platform that combines **real-time capital market news**, an **interactive 3D global markets globe**, **high-density technical & fundamental analytics**, and a **contextual Gemini AI analyst** inside a cleanly isolated **Dual-Mode** architecture:

1. **News Mode (Editorial Broadsheet — Light Theme `#FBFBFA`):** A financial-broadsheet reading experience powered by 3-day multi-source RSS aggregation, **AI Market Brief** summaries, quick wire hover previews, persistent bookmarks, and direct ticker navigation into the Terminal.
2. **Terminal Mode (Unified Obsidian Workstation — Dark Theme `#080A0F`):** A single top-down Matte Obsidian + StocksSense Teal command center unifying a **3D Interactive World Globe (Three.js)**, **IDX Market Overview**, and **IDX Stock Research Workstation** with **Dual Parallax Mapping**.

---

## 🌟 Key Features

### 1. 🌍 Unified Terminal: 3D World Globe + IDX Overview + Stock Research
* **3D Interactive World Globe (Three.js + PBR Relief):**
  * Tracks **10 major global financial hubs** (`ID`, `US`, `JP`, `HK`, `SG`, `KR`, `CN`, `UK`, `DE`, `AU`) with benchmark indices and **40 live blue-chip equities** (`NVDA`, `AAPL`, `Toyota`, `Tencent`, `DBS`, `Samsung`, `AstraZeneca`, `SAP`, `BHP`, `BBCA`, `BMRI`, etc.) with automatic local-currency formatting (`IDR`, `USD`, `JPY`, `HKD`, `SGD`, `KRW`, `CNY`, `GBP`, `EUR`, `AUD` — including `GBp → GBP` normalization for LSE equities).
  * Procedurally synthesizes local PBR textures directly from real `world-atlas` geographic polygons (*obsidian albedo + night-lights*, *topographic bump-relief*, and *ocean roughness*), paired with a custom GLSL teal Fresnel atmosphere halo, glowing active-country borders, animated 3D great-circle capital-flow arcs into Jakarta (`IDX`), timezone-aware open/closed exchange pulses, smooth spherical fly-to rotation, screen-space anti-overlap badge repulsion, and automatic GPU pause (`IntersectionObserver`).
* **Dual Parallax Mapping:**
  * **Scroll-Linked Parallax Curtain (`framer-motion` `useScroll` + `useTransform`):** Scrolling from the 3D Global Command Deck down to the IDX Research Workstation smoothly recedes the globe with scroll-coupled camera pitch while the research workstation glides up and locks rock-solid for numerical analysis.
  * **3D Surface Relief & Pointer Parallax:** Subtle continental bump relief and pointer-driven 3D camera/starfield depth motion.
* **Integrated IDX Market Overview:**
  * Compact breadth summary (`Advancers/Decliners`, `Strongest Sector`, `Buy-Zone Signals`), 1-click **IDX Sector Heatmap**, **Top Movers** (`Gainers` / `Losers` / `Buy Zone`), and a multi-series **Relative Performance Chart** (`IHSG` vs `S&P 500`, `Gold`, `Brent`).
* **IDX Stock Research Workstation:**
  * **5-Pillar Stock Health Ribbon:** Interactive health pods (**P/E Valuation**, **ROE Profitability**, **Banking-Aware DER**, **Dividend Yield**, and **Target Buy Price**) linking directly to their analysis tabs or inline target editor.
  * **Interactive Charting (`lightweight-charts` v5):** `Candlestick` & `Line` modes, `1M`–`All` timeframes, `MA20`, `MA50`, `RSI`, `Volume`, dividend markers, plus **Fair Value** and **Target Buy** price lines.
  * **P/E Valuation & Interactive Valuation Gauge Arc:** Semi-circular P/E deviation meter (`-2 SD` to `+2 SD`) with clickable/hoverable stops projecting implied price and upside/downside, curated & dynamic 5-year P/E bands (for custom IDX stocks), and **Benjamin Graham Intrinsic Value**.
  * **DCA & Lump-Sum Backtest Simulator:** Quarterly accumulation simulation powered by real split-adjusted Yahoo Finance price & dividend history with optional **DRIP** reinvestment benchmarked against IHSG.
  * **Multi-Stock Comparison & Watchlist Allocation:** Side-by-side relative return curves & fundamental metrics, plus IDX lot allocation, dividend projection, and sector concentration analysis.
  * **Quick Research Rail & Watchlist Screener:** Interactive budget slider (`Rp 1M – 100M`) with real-time Fair Value / Target Buy upside simulation, persistent custom Watchlist (up to 15 IDX stocks with target prices, research notes, and JSON backup export/import).

### 2. ⌨️ Navigation & Terminal Keyboard Shortcuts
* **Top Sub-Bar & Persistent Bottom Utility Dock:** Quick panel toggles, Workspace Layout Presets (`Focus` / `Standard` / `Full`), live active ticker telemetry, and automatic dock right-offset when the AI side drawer opens.
* **Global Command Search (`S` or `⌘K` / `Ctrl+K`):** Instant search across all IDX stocks (including live Yahoo Finance lookup) with `All` / `Watchlist` / `Curated` tabs, inline SVG sparklines, P/E badges, and full keyboard navigation (`↑`/`↓`/`Enter`/`Esc`).
* **Terminal Shortcuts:**
  * `S` or `⌘K` / `Ctrl+K` — Open Stock Command Search
  * `G` — Collapse / expand the 3D Global & Overview Command Deck
  * `[` — Toggle Watchlist sidebar
  * `]` — Toggle Right Quick Research Rail (Lot & Target)
  * `F` — Toggle full-width Focus Chart preset

### 3. 📰 News Mode (Editorial Broadsheet)
* **Multi-Source 3-Day Capital Market RSS Pipeline:** Automatic category classification, IDX ticker detection, Watchlist & category filters, article bookmarks, reading progress bar, and hover previews.
* **AI Market Brief:** On-demand daily macro & sector synthesis tailored to the latest headlines and user Watchlist tickers.
* **Strict Theme & Bundle Isolation:** Runs purely in `#FBFBFA` editorial paper styling without loading Three.js chunks or calling `/api/global-markets`.

### 4. 🤖 Integrated Gemini AI Analyst
* Contextual research side panel (`POST /api/ai/analyze`) automatically aware of the active stock, valuation metrics, Watchlist targets, related news, portfolio allocation, and global hub sentiment (*"Analyze Country Market Impact on IHSG"*).
* Supports both server-configured keys (`GEMINI_API_KEY`) and client-side Bring-Your-Own-Key (BYOK).

---

## 🛠️ Tech Stack & Architecture

* **Framework:** [Next.js 16](https://nextjs.org/) (App Router, `"use cache"` Cache Components, Webpack production build)
* **Runtime & Language:** [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/)
* **Styling & Motion:** [Tailwind CSS v4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/), [Lucide Icons](https://lucide.dev/)
* **3D & Financial Charts:** [Three.js](https://threejs.org/) (`world-atlas` + `topojson-client`), [TradingView Lightweight Charts v5](https://tradingview.github.io/lightweight-charts/)
* **Market Data & AI:** [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2), Multi-source RSS aggregator, Google Gemini API
* **Testing:** [Vitest](https://vitest.dev/) (`84` unit tests across `19` test files)
* **Typography & Localization:** *Literata*, *IBM Plex Sans*, *IBM Plex Mono* (`tabular-nums`), centralized Indonesian number formatting (`id-ID`) in [src/lib/format.ts](src/lib/format.ts).

```text
stocksense/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/analyze/route.ts         # Contextual Gemini AI analyst endpoint
│   │   │   ├── global-markets/route.ts     # 10 global exchanges + 40 blue chips snapshot
│   │   │   ├── history/[ticker]/route.ts   # OHLCV & dividend history (Yahoo / illustrative)
│   │   │   ├── macro/route.ts              # Macro tickers (IHSG, USD/IDR, S&P500, Gold, Brent)
│   │   │   ├── news/route.ts               # 3-day multi-source capital market RSS pipeline
│   │   │   ├── news/brief/route.ts         # On-demand AI Market Brief generator
│   │   │   ├── quotes/route.ts             # Batched live IDX equity quotes
│   │   │   └── stocks/                     # IDX company fundamentals & live ticker search
│   │   ├── page.tsx                        # Dual-Mode orchestrator (Unified Terminal & News)
│   │   └── terminal/page.tsx               # Permalink redirect into Terminal Mode
│   ├── components/
│   │   ├── ai/GeminiAiModal.tsx            # Contextual Gemini AI side drawer
│   │   ├── layout/                         # Navbar & macro MarketTicker bar
│   │   ├── news/                           # Editorial Broadsheet, AI Brief, Reader Drawer, Dock
│   │   └── terminal/
│   │       ├── WorldGlobe3D.tsx            # 3D Interactive World Globe (Three.js + PBR)
│   │       ├── UnifiedGlobalCommandDeck.tsx# 3D Command Deck + IDX Overview + Scroll Parallax
│   │       ├── TerminalTopBar.tsx          # Top Sub-Bar & Workspace Layout Presets
│   │       ├── TerminalBottomDock.tsx      # Persistent Bottom Utility Dock
│   │       ├── TerminalCommandSearch.tsx   # Command-Palette Search modal (S / ⌘K)
│   │       ├── TerminalMainPane.tsx        # Price header, chart, Valuation/DCA/Profile/News tabs
│   │       ├── StockHealthRibbon.tsx       # 5 interactive stock health pods
│   │       ├── ValuationGaugeArc.tsx       # Interactive P/E deviation arc (-2 SD..+2 SD)
│   │       ├── LightweightPriceChart.tsx   # Candlestick/Line chart + technical overlays
│   │       ├── QuickResearchRail.tsx       # Interactive lot budget slider & upside simulator
│   │       ├── TerminalWatchlist.tsx       # Watchlist, screener, target alerts & JSON backup
│   │       ├── MarketOverviewPane.tsx      # IDX sector heatmap, Top Movers & Relative Chart
│   │       ├── StockCompareTab.tsx         # Head-to-head multi-stock comparison
│   │       └── StockAllocationTab.tsx      # Watchlist capital & IDX lot allocation simulator
│   ├── hooks/                              # useMarketData, useGlobalMarkets, useLiveNews, useAiChat
│   ├── data/                               # Curated IDX reference & fallback macro datasets
│   └── lib/                                # Yahoo cache, market hours, valuation, global markets & __tests__/
└── package.json
```

---

## 🚀 Getting Started Locally

Make sure you have [Node.js](https://nodejs.org/) **v22+** (or v20+) installed.

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/christianlandrawicaksono-collab/stocksense.git
   cd stocksense
   npm install
   ```

2. **Configure Environment Variables (optional — create `.env.local`):**
   ```env
   # Use "yahoo" for live market quotes & RSS news, or "illustrative" for offline reference data
   MARKET_DATA_PROVIDER=yahoo

   # Optional: Google Gemini API key for AI Analyst & AI Market Brief
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3-flash-preview
   ```
   > Without `.env.local`, the app runs cleanly out of the box in `illustrative` mode using built-in reference datasets, and users can still supply a personal Gemini API key directly inside the AI side panel.

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` (News Mode) or `http://localhost:3000/?mode=terminal` (Unified 3D Terminal).

4. **Run Tests, Linting, and Production Build:**
   ```bash
   npm test
   npx eslint src
   npm run build
   ```

---

## ⚖️ Data Integrity & Disclaimer

1. **Transparent Data Sourcing:** When `MARKET_DATA_PROVIDER=yahoo` is enabled, IDX equities, global benchmark indices, and international blue-chip quotes are fetched via **Yahoo Finance** (~10–15 minute delayed depending on exchange) with server-side caching, while market news is aggregated from public **capital-market RSS feeds**. Whenever an upstream source is unavailable or `illustrative` mode is active, the UI explicitly labels metrics as **Illustrative / Reference Data**.
2. **Not Financial Advice:** All charts, valuation models, DCA/lot simulations, and AI-generated outputs are provided strictly for **research and educational purposes** and do not constitute licensed investment advice or buy/sell recommendations.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
