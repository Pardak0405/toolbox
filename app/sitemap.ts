import { allTools } from "@/tools/registry";
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL;
  const staticPages = [
    "",
    "/workflows",
    "/privacy",
    "/terms",
    "/about",
    "/editorial-policy",
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
