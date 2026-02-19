import AdSlot from "@/app/_components/AdSlot";
import ToolGrid from "@/app/_components/ToolGrid";
import { allTools, categories } from "@/tools/registry";

export default function HomePage() {
  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="badge">100% free, no install</span>
            <h1 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
              Your free document toolkit, crafted for busy teams.
            </h1>
            <p className="mt-4 text-base text-muted">
              Merge, convert, scan, and secure files in a privacy-first browser
              workspace. Upgrade to local engine for advanced conversions.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#organize"
                className="rounded-full bg-ember px-6 py-2 text-sm font-semibold text-white"
              >
                Explore tools
              </a>
              <a
                href="/workflows"
                className="rounded-full border border-line px-6 py-2 text-sm font-semibold"
              >
                Build a workflow
              </a>
            </div>
          </div>
          <div className="rounded-3xl border border-line bg-fog p-6">
            <p className="text-sm font-semibold">Popular workflow</p>
            <ol className="mt-4 space-y-3 text-sm text-muted">
              <li>1. Scan to PDF</li>
              <li>2. OCR to text</li>
              <li>3. Protect with password</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <AdSlot slotId="TOP" className="min-h-[100px]" />
      </section>

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
