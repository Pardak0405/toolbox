import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.slogan,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ef4444",
    icons: [
      {
        src: "/og-placeholder.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
