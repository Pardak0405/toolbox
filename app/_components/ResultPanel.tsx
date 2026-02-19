"use client";

import Link from "next/link";
import { DownloadCloud, RotateCcw } from "lucide-react";
import { saveAs } from "file-saver";
import { ToolDefinition } from "@/tools/registry";

export default function ResultPanel({
  fileName,
  downloadUrl,
  onReset,
  recommendations
}: {
  fileName: string;
  downloadUrl: string;
  onReset: () => void;
  recommendations: ToolDefinition[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <h3 className="text-lg font-semibold">Your file is ready</h3>
      <p className="text-sm text-muted">Download or run another tool.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => saveAs(downloadUrl, fileName)}
          className="inline-flex items-center gap-2 rounded-full bg-ember px-5 py-2 text-sm font-semibold text-white"
        >
          <DownloadCloud className="h-4 w-4" /> Download
        </button>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2 text-sm font-semibold"
        >
          <RotateCcw className="h-4 w-4" /> Start over
        </button>
      </div>
      <div className="mt-6">
        <p className="text-sm font-semibold">Try another tool</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {recommendations.map((tool) => (
            <Link
              key={tool.id}
              href={`/${tool.slug}`}
              className="rounded-full border border-line px-3 py-1 text-xs hover:border-ember"
            >
              {tool.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
