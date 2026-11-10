import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Literata } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "StocksSense — Analisis Pasar & Saham Indonesia",
  description: "Terminal intelijen pasar saham Indonesia (IHSG), analisis valuasi P/E band, simulator DCA, dan transmisi makroekonomi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${plexSans.variable} ${plexMono.variable} ${literata.variable} h-full antialiased dark`}
    >
      <body
        className="min-h-full flex flex-col bg-[#0C1017] text-slate-100 font-sans selection:bg-[#1E7B85]/30"
      >
        {children}
      </body>
    </html>
  );
}
