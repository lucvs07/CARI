import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { themeInitScript } from "@/features/shell/theme";
import "./globals.css";

const chillax = localFont({
  variable: "--font-chillax",
  display: "swap",
  src: [
    { path: "../public/fonts/chillax/chillax-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/chillax/chillax-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/chillax/chillax-600.woff2", weight: "600", style: "normal" },
  ],
});

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "CARI",
  description: "Estoque e lista de compras da casa, em família.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${chillax.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <Toaster duration={6000} />
      </body>
    </html>
  );
}
