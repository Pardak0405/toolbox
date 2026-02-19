import { allTools } from "@/tools/registry";
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://example.local";
  const staticPages = [
    "",
    "/workflows",
    "/privacy",
    "/terms",
    "/about",
    "/contact",
    "/faq"
  ];

  return [
    ...staticPages.map((path) => ({
      url: `${base}${path}`,
      lastModified: new Date()
    })),
    ...allTools.map((tool) => ({
      url: `${base}/${tool.slug}`,
      lastModified: new Date()
    }))
  ];
}
