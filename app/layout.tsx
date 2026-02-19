import type { Metadata } from "next";
import { Fraunces, Sora } from "next/font/google";
import "./globals.css";
import TopNav from "@/app/_components/TopNav";
import Footer from "@/app/_components/Footer";
import { BRAND, getBrandOrigin } from "@/config/brand";

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
  title: `${BRAND.name} - 무료 문서 툴킷`,
  description: BRAND.slogan,
  metadataBase: new URL(getBrandOrigin()),
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: `${BRAND.name} - 무료 문서 툴킷`,
    description: BRAND.slogan,
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: BRAND.name,
              description: BRAND.slogan,
              url: getBrandOrigin()
            })
          }}
        />
        <TopNav />
        <main className="px-5 md:px-10 lg:px-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
