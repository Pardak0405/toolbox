import { notFound } from "next/navigation";
import ToolClient from "@/app/[tool]/ToolClient";
import { BRAND, getBrandOrigin } from "@/config/brand";
import { allTools, getToolBySlug, getToolMetaDescription } from "@/tools/registry";

type ToolPageProps = {
  params: Promise<{ tool: string }>;
};

export default async function ToolPage({ params }: ToolPageProps) {
  const { tool: toolSlug } = await params;
  const tool = getToolBySlug(toolSlug);
  if (!tool) {
    notFound();
  }

  return <ToolClient toolSlug={toolSlug} />;
}

export async function generateStaticParams() {
  return allTools.map((tool) => ({ tool: tool.slug }));
}

export async function generateMetadata({
  params
}: ToolPageProps) {
  const { tool: toolSlug } = await params;
  const tool = getToolBySlug(toolSlug);
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
