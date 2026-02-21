import AdSlot from "@/app/_components/AdSlot";
import HomeToolExplorer from "@/app/_components/HomeToolExplorer";
import HomeTrustSeoSection from "@/app/_components/HomeTrustSeoSection";
import ToolGrid from "@/app/_components/ToolGrid";
import { allTools, categories } from "@/tools/registry";
import { BRAND } from "@/config/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Toolbox - 무료 문서 변환기"
};

export default function HomePage() {
  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="badge">100% free, no install</span>
            <h1 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
              {BRAND.slogan}
            </h1>
            <p className="mt-4 text-base text-muted">
              Merge, convert, scan, and secure files in a privacy-first browser
              workspace. Upgrade to local engine for advanced conversions.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#organize"
                className="btn-primary rounded-full px-6 py-2 text-sm font-semibold"
              >
                Explore tools
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <AdSlot slotId="TOP" className="min-h-[100px]" />
      </section>

      <HomeToolExplorer />

      <HomeTrustSeoSection />

      {categories.map((category) => {
        const tools = allTools.filter((tool) => tool.category === category);
        return (
          <section
            key={category}
            id={category.toLowerCase().replace(/\s+/g, "-")}
            className="mt-12"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl">{category}</h2>
              <span className="text-xs text-muted">
                {tools.length} tools
              </span>
            </div>
            <ToolGrid tools={tools} />
          </section>
        );
      })}
    </div>
  );
}
