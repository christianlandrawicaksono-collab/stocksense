import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StocksSense — Smart Indonesian Stock & Macro Intelligence Terminal",
  description: "Terminal intelijen pasar saham Indonesia (IHSG), transmisi dampak makroekonomi/geopolitik, simulator strategi investasi DCA, dan PE Valuation Bands.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body 
        className="min-h-full flex flex-col bg-[#070b13] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
