import type { Metadata } from "next";
import { Fraunces, Sora } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import TopNav from "@/app/_components/TopNav";
import Footer from "@/app/_components/Footer";
import { BRAND, getBrandOrigin } from "@/config/brand";
import { SITE_URL } from "@/config/site";

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
  title: {
    default: "Toolbox - 무료 문서 변환기",
    template: "%s | Toolbox"
  },
  applicationName: "Toolbox",
  description:
    "업로드 없이 빠르게, 내 PC에서 처리하는 무료 문서 변환기. JPG, PNG, PDF, Word, Excel 등 다양한 파일을 안전하게 변환하세요.",
  metadataBase: new URL(getBrandOrigin()),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/icon-192.png"
  },
  openGraph: {
    title: "Toolbox - 무료 문서 변환기",
    description: "JPG, PNG, PDF, Word, Excel 파일을 업로드 없이 빠르게 변환하세요.",
    images: [
      {
        url: "https://alltoolbox.online/favicon.png",
        width: 512,
        height: 512,
        alt: "AllToolbox 대표 이미지"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://alltoolbox.online/favicon.png"]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const websiteJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.name,
    description: BRAND.slogan,
    url: getBrandOrigin()
  });

  const orgJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    url: SITE_URL,
    logo: "https://alltoolbox.online/favicon.png",
    description: "업로드 없이 브라우저에서 작동하는 무료 문서 변환기"
  });

  return (
    <html lang="en" className={`${fraunces.variable} ${sora.variable}`}>
      <head>
        <meta name="robots" content="max-image-preview:large" />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=pub-4301110787085467"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body>
        <Script id="website-jsonld" type="application/ld+json" strategy="afterInteractive">
          {websiteJsonLd}
        </Script>
        <Script id="org-jsonld" type="application/ld+json" strategy="afterInteractive">
          {orgJsonLd}
        </Script>
        <TopNav />
        <main className="px-5 md:px-10 lg:px-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
