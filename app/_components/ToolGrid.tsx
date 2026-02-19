import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { ToolDefinition } from "@/tools/registry";

export default function ToolGrid({
  tools
}: {
  tools: ToolDefinition[];
}) {
  return (
    <div className="card-grid">
      {tools.map((tool) => {
        const Icon = tool.icon as LucideIcon;
        return (
          <Link key={tool.id} href={`/${tool.slug}`} className="tool-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fog text-ember">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{tool.title}</h3>
                <p className="text-xs text-muted">{tool.category}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">{tool.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {tool.inputTypes.slice(0, 3).map((type) => (
                <span key={type} className="badge">
                  {type.toUpperCase()}
                </span>
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
