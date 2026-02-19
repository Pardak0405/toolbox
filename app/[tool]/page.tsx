import { notFound } from "next/navigation";
import ToolClient from "@/app/[tool]/ToolClient";
import { BRAND, getBrandOrigin } from "@/config/brand";
import { allTools, getToolBySlug, getToolMetaDescription } from "@/tools/registry";

export default function ToolPage({ params }: { params: { tool: string } }) {
  const tool = getToolBySlug(params.tool);
  if (!tool) {
    notFound();
  }

  return <ToolClient tool={tool} />;
}

export async function generateStaticParams() {
  return allTools.map((tool) => ({ tool: tool.slug }));
}

export async function generateMetadata({
  params
}: {
  params: { tool: string };
}) {
  const tool = getToolBySlug(params.tool);
  if (!tool) return {};
  const description = getToolMetaDescription(tool);
  return {
    title: `${tool.title} - ${BRAND.name}`,
    description,
    alternates: { canonical: `${getBrandOrigin()}/${tool.slug}` },
    openGraph: {
      title: `${tool.title} - ${BRAND.name}`,
      description,
      images: ["/og-placeholder.svg"]
    }
  };
}
