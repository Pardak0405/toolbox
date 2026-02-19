import type { Metadata } from "next";
import { Fraunces, Sora } from "next/font/google";
import "./globals.css";
import TopNav from "@/app/_components/TopNav";
import Footer from "@/app/_components/Footer";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  title: "DocForge — Free Document Toolkit",
  description: "A privacy-first document toolkit: merge, split, convert, OCR, and more — right in your browser.",
  metadataBase: new URL("https://example.local"),
  openGraph: {
    title: "DocForge — Free Document Toolkit",
    description: "Work with PDFs, images, and office files without leaving the browser.",
    images: ["/og-placeholder.svg"]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sora.variable}`}>
      <body>
        <TopNav />
        <main className="px-5 md:px-10 lg:px-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
