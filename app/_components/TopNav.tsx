"use client";

import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { categories, toolsRegistry } from "@/tools/registry";
import { BRAND } from "@/config/brand";

export default function TopNav() {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return toolsRegistry
      .filter((tool) =>
        tool.title.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 6);
  }, [query]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/80 backdrop-blur">
      <div className="px-5 md:px-10 lg:px-16 py-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/" aria-label="Toolbox 홈으로 이동" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Toolbox 로고"
              width={240}
              height={60}
              className="h-8 md:h-10 w-auto"
              priority
            />
            <div className="hidden sm:block">
              <p className="text-xs text-muted">{BRAND.slogan}</p>
            </div>
          </Link>
          <div className="relative w-full md:w-[360px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools"
              className="w-full rounded-full border border-line bg-white py-2 pl-9 pr-4 text-sm focus:border-ember focus:outline-none"
            />
            {matches.length > 0 ? (
              <div className="absolute left-0 right-0 mt-2 rounded-xl border border-line bg-white p-2 shadow-soft">
                {matches.map((tool) => (
                  <Link
                    key={tool.id}
                    href={`/${tool.slug}`}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-fog"
                  >
                    {tool.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <nav className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              key={category}
              href={`/#${category.toLowerCase().replace(/\s+/g, "-")}`}
              className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-ember hover:text-ember"
            >
              {category}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
