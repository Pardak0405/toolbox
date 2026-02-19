"use client";

import { useMemo, useState } from "react";
import ToolGrid from "@/app/_components/ToolGrid";
import { allTools, categories } from "@/tools/registry";

export default function HomeToolExplorer() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return allTools.filter((tool) => {
      const categoryMatch = activeCategory === "All" || tool.category === activeCategory;
      const queryMatch =
        lowered.length === 0 ||
        tool.title.toLowerCase().includes(lowered) ||
        tool.description.toLowerCase().includes(lowered);
      return categoryMatch && queryMatch;
    });
  }, [query, activeCategory]);

  return (
    <section className="mt-12">
      <div className="rounded-3xl bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-2xl">Find the right tool</h2>
            <p className="text-sm text-muted">카테고리와 검색으로 30개 툴을 빠르게 찾을 수 있습니다.</p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools by name or description"
            className="w-full rounded-xl border border-line px-4 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              className={`rounded-full px-3 py-1 text-xs border ${
                activeCategory === "All" ? "border-ember text-ember" : "border-line text-muted"
              }`}
              onClick={() => setActiveCategory("All")}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                className={`rounded-full px-3 py-1 text-xs border ${
                  activeCategory === category
                    ? "border-ember text-ember"
                    : "border-line text-muted"
                }`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <ToolGrid tools={filtered} />
          {filtered.length === 0 ? (
            <p className="mt-4 text-sm text-muted">검색 결과가 없습니다.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
