import type { MetadataRoute } from "next";
import { getBrandOrigin } from "@/config/brand";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const base = getBrandOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    sitemap: `${base}/sitemap.xml`
  };
}
