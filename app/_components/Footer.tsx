"use client";

import Link from "next/link";
import AdSlot from "@/app/_components/AdSlot";
import { BRAND } from "@/config/brand";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-white px-5 md:px-10 lg:px-16 py-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-lg">{BRAND.name}</p>
          <p className="text-sm text-muted">
            {BRAND.slogan}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link className="ghost-link" href="/about">About</Link>
          <Link className="ghost-link" href="/editorial-policy">Editorial Policy</Link>
          <Link className="ghost-link" href="/privacy">Privacy</Link>
          <Link className="ghost-link" href="/terms">Terms</Link>
          <Link className="ghost-link" href="/faq">FAQ</Link>
          <Link className="ghost-link" href="/contact">Contact</Link>
        </div>
      </div>
      <div className="mt-6">
        <AdSlot slotId="FOOTER" className="min-h-[90px]" />
      </div>
      <p className="mt-6 text-xs text-muted">
        Ads appear only in non-intrusive slots. Processing happens in your
        browser unless you opt into the local engine.
      </p>
      <p className="mt-2 text-xs text-muted">
        Last updated: 2026-02-20
      </p>
    </footer>
  );
}
