import { notFound } from "next/navigation";
import ToolClient from "@/app/[tool]/ToolClient";
import { allTools, getToolBySlug } from "@/tools/registry";

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
  return {
    title: `${tool.title} - DocForge`,
    description: tool.description,
    alternates: { canonical: `/${tool.slug}` },
    openGraph: {
      title: `${tool.title} - DocForge`,
      description: tool.description,
      images: ["/og-placeholder.svg"]
    }
  };
}
