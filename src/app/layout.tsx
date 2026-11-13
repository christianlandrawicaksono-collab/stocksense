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
  title: "StocksSense — Riset Transmisi Makro & Analisis Saham IDX",
  description: "Terminal intelijen pasar saham Indonesia (IHSG), analisis valuasi P/E band, simulator DCA kuartalan, dan transmisi skenario makroekonomi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${plexSans.variable} ${plexMono.variable} ${literata.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans selection:bg-[#1E7B85]/20">
        {children}
      </body>
    </html>
  );
}
