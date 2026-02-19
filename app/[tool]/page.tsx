"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DropzoneUploader from "@/app/_components/DropzoneUploader";
import FileQueue, { FileQueueItem } from "@/app/_components/FileQueue";
import OptionsPanel from "@/app/_components/OptionsPanel";
import PdfPreview from "@/app/_components/PdfPreview";
import ProgressModal from "@/app/_components/ProgressModal";
import ResultPanel from "@/app/_components/ResultPanel";
import AdSlot from "@/app/_components/AdSlot";
import {
  allTools,
  getRecommendations,
  getToolBySlug
} from "@/tools/registry";
import { createDownloadUrl } from "@/app/_lib/utils";

const multiTools = new Set([
  "merge-pdf",
  "scan-to-pdf",
  "jpg-to-pdf",
  "pdf-to-jpg",
  "compare-pdf"
]);

export default function ToolPage({ params }: { params: { tool: string } }) {
  const tool = getToolBySlug(params.tool);
  const router = useRouter();

  const [items, setItems] = useState<FileQueueItem[]>([]);
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ url: string; name: string } | null>(
    null
  );
  const [processing, setProcessing] = useState(false);
  const [localToken, setLocalToken] = useState("");

  if (!tool) {
    router.replace("/");
    return null;
  }

  const accept = useMemo(() => {
    const map: Record<string, string[]> = {};
    tool.inputTypes.forEach((type) => {
      if (type === "pdf") map["application/pdf"] = [".pdf"];
      if (type === "jpg" || type === "jpeg")
        map["image/jpeg"] = [".jpg", ".jpeg"];
      if (type === "png") map["image/png"] = [".png"];
      if (type === "image")
        map["image/*"] = [".jpg", ".jpeg", ".png"];
      if (type === "doc" || type === "docx")
        map["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = [
          ".doc",
          ".docx"
        ];
      if (type === "ppt" || type === "pptx")
        map["application/vnd.openxmlformats-officedocument.presentationml.presentation"] = [
          ".ppt",
          ".pptx"
        ];
      if (type === "xls" || type === "xlsx")
        map["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] = [
          ".xls",
          ".xlsx"
        ];
      if (type === "html") map["text/html"] = [".html"];
    });
    return map;
  }, [tool.inputTypes]);

  const recommendations = getRecommendations(tool);
  const defaultOptions = useMemo(() => {
    return tool.optionsSchema.reduce<Record<string, unknown>>((acc, field) => {
      if (field.defaultValue !== undefined) acc[field.id] = field.defaultValue;
      return acc;
    }, {});
  }, [tool.optionsSchema]);

  const handleFiles = (files: File[]) => {
    const nextItems = files.map((file) => ({
      id: `${file.name}-${crypto.randomUUID()}`,
      file
    }));
    setItems((prev) => (multiTools.has(tool.id) ? [...prev, ...nextItems] : nextItems));
  };

  const processBrowser = async () => {
    if (!tool.runBrowser) return;
    setProcessing(true);
    setProgress(10);
    setStatus("Preparing files");
    try {
      const finalOptions = { ...defaultOptions, ...options };
      const result = await tool.runBrowser(
        items.map((item) => item.file),
        finalOptions,
        (nextProgress, nextStatus) => {
          setProgress(nextProgress);
          setStatus(nextStatus);
        }
      );
      setProgress(100);
      setStatus("Done");
      const url = createDownloadUrl(result.blob);
      setResult({ url, name: result.fileName });
    } catch (error) {
      console.error(error);
      alert("Processing failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const processLocal = async () => {
    if (!tool.runLocal) return;
    if (!localToken) {
      alert("Add your local engine session token.");
      return;
    }
    setProcessing(true);
    setProgress(10);
    setStatus("Sending files to local engine");
    try {
      const finalOptions = { ...defaultOptions, ...options };
      const result = await tool.runLocal(
        items.map((item) => item.file),
        finalOptions,
        localToken
      );
      setProgress(100);
      setStatus("Done");
      const url = createDownloadUrl(result.blob);
      setResult({ url, name: result.fileName });
    } catch (error) {
      console.error(error);
      alert("Local engine failed. Check your server and token.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="py-10">
      <section className="rounded-3xl bg-white p-8 shadow-soft">
        <div className="flex flex-col gap-3">
          <span className="badge">{tool.category}</span>
          <h1 className="font-display text-3xl">{tool.title}</h1>
          <p className="text-sm text-muted">{tool.description}</p>
        </div>
        <div className="mt-6">
          <DropzoneUploader
            accept={accept}
            multiple={multiTools.has(tool.id)}
            capture={tool.id === "scan-to-pdf" ? "environment" : undefined}
            onFiles={handleFiles}
            helper="We keep your files in this browser session unless you use the local engine."
          />
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <PdfPreview
            file={tool.inputTypes.includes("pdf") ? items[0]?.file ?? null : null}
          />
          <AdSlot slotId="SIDE" className="min-h-[160px]" />
        </div>
        <div className="space-y-6">
          <FileQueue
            items={items}
            onChange={setItems}
            onRemove={(id) =>
              setItems((prev) => prev.filter((item) => item.id !== id))
            }
          />
          <OptionsPanel
            schema={tool.optionsSchema}
            options={options}
            onChange={setOptions}
          />
          {tool.engine !== "browser" ? (
            <div className="rounded-2xl border border-line bg-white p-5">
              <h4 className="font-semibold">Local engine</h4>
              <p className="text-xs text-muted">
                For advanced conversions, run the local engine and add your
                session token.
              </p>
              <input
                value={localToken}
                onChange={(event) => setLocalToken(event.target.value)}
                placeholder="Session token"
                className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={processBrowser}
              disabled={items.length === 0 || processing}
              className="rounded-full bg-ember px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Run in browser
            </button>
            {tool.runLocal ? (
              <button
                onClick={processLocal}
                disabled={items.length === 0 || processing}
                className="rounded-full border border-line px-6 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Run local engine
              </button>
            ) : null}
          </div>
          {result ? (
            <ResultPanel
              fileName={result.name}
              downloadUrl={result.url}
              onReset={() => {
                setItems([]);
                setResult(null);
                setOptions({});
              }}
              recommendations={recommendations}
            />
          ) : null}
        </div>
      </section>

      <section className="mt-10 rounded-3xl bg-white p-8">
        <h2 className="font-display text-2xl">Frequently asked questions</h2>
        <div className="mt-4 space-y-3">
          {[
            `How is ${tool.title} processed?`,
            `Can I run ${tool.title} offline?`,
            `What file size limits apply?`
          ].map((question) => (
            <details
              key={question}
              className="rounded-2xl border border-line bg-fog p-4"
            >
              <summary className="cursor-pointer text-sm font-semibold">
                {question}
              </summary>
              <p className="mt-2 text-sm text-muted">
                Browser mode runs locally in your tab. For larger files, enable
                the local engine for higher-quality output. Limits depend on
                device memory and browser settings.
              </p>
            </details>
          ))}
        </div>
      </section>

      <ProgressModal
        open={processing}
        progress={progress}
        status={status}
        onCancel={() => setProcessing(false)}
      />
    </div>
  );
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
    title: `${tool.title} — DocForge`,
    description: tool.description,
    alternates: { canonical: `/${tool.slug}` },
    openGraph: {
      title: `${tool.title} — DocForge`,
      description: tool.description,
      images: ["/og-placeholder.svg"]
    }
  };
}
