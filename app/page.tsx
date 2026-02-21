import AdSlot from "@/app/_components/AdSlot";
import HomeToolExplorer from "@/app/_components/HomeToolExplorer";
import ToolGrid from "@/app/_components/ToolGrid";
import { allTools, categories } from "@/tools/registry";
import { BRAND } from "@/config/brand";

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

      <HomeToolExplorer />

      <section className="mt-12 grid gap-6 lg:grid-cols-3">
        <article className="rounded-2xl border border-line bg-white p-6">
          <h2 className="font-display text-xl">왜 신뢰할 수 있나요?</h2>
          <p className="mt-3 text-sm text-muted">
            각 툴 페이지는 기능 버튼만 제공하지 않고 사용 목적, 단계별 가이드,
            실패 시 대처 방법, 관련 툴까지 포함합니다. 사용자는 한 번의 방문으로
            작업 흐름 전체를 이해할 수 있습니다.
          </p>
        </article>
        <article className="rounded-2xl border border-line bg-white p-6">
          <h2 className="font-display text-xl">콘텐츠 품질 원칙</h2>
          <p className="mt-3 text-sm text-muted">
            중복 페이지를 늘리지 않고, 도구별로 실제 업무 사례 중심의 설명을
            제공합니다. 과장된 키워드보다 문제 해결에 필요한 실제 정보를 우선해
            콘텐츠를 운영합니다.
          </p>
        </article>
        <article className="rounded-2xl border border-line bg-white p-6">
          <h2 className="font-display text-xl">광고 운영 원칙</h2>
          <p className="mt-3 text-sm text-muted">
            광고는 상단, 사이드, 푸터의 고정 영역에만 노출됩니다. 업로드·옵션·실행
            같은 핵심 작업 흐름을 가리지 않으며 콘텐츠와 탐색성을 우선합니다.
          </p>
        </article>
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
