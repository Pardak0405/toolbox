"use client";

import { useEffect, useMemo, useState } from "react";
import DropzoneUploader from "@/app/_components/DropzoneUploader";
import FileQueue, { FileQueueItem } from "@/app/_components/FileQueue";
import OptionsPanel from "@/app/_components/OptionsPanel";
import PdfPreview from "@/app/_components/PdfPreview";
import ProgressModal from "@/app/_components/ProgressModal";
import ResultPanel from "@/app/_components/ResultPanel";
import AdSlot from "@/app/_components/AdSlot";
import { getRecommendations, ToolDefinition } from "@/tools/registry";
import { createDownloadUrl } from "@/app/_lib/utils";

const multiTools = new Set([
  "merge-pdf",
  "scan-to-pdf",
  "jpg-to-pdf",
  "pdf-to-jpg",
  "compare-pdf"
]);

export default function ToolClient({ tool }: { tool: ToolDefinition }) {
  const [items, setItems] = useState<FileQueueItem[]>([]);
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ url: string; name: string } | null>(
    null
  );
  const [processing, setProcessing] = useState(false);
  const [localToken, setLocalToken] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const accept = useMemo(() => {
    const map: Record<string, string[]> = {};
    tool.inputTypes.forEach((type) => {
      if (type === "pdf") map["application/pdf"] = [".pdf"];
      if (type === "jpg" || type === "jpeg") {
        map["image/jpeg"] = [".jpg", ".jpeg"];
      }
      if (type === "png") map["image/png"] = [".png"];
      if (type === "image") map["image/*"] = [".jpg", ".jpeg", ".png"];
      if (type === "doc" || type === "docx") {
        map[
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ] = [".doc", ".docx"];
      }
      if (type === "ppt" || type === "pptx") {
        map[
          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ] = [".ppt", ".pptx"];
      }
      if (type === "xls" || type === "xlsx") {
        map[
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ] = [".xls", ".xlsx"];
      }
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

  useEffect(() => {
    return () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const handleFiles = (files: File[]) => {
    setErrorMessage("");
    const nextItems = files.map((file) => ({
      id: `${file.name}-${crypto.randomUUID()}`,
      file
    }));
    setItems((prev) => (multiTools.has(tool.id) ? [...prev, ...nextItems] : nextItems));
  };

  const processBrowser = async () => {
    if (!tool.runBrowser) return;
    if (items.length === 0) return;

    setErrorMessage("");
    setProcessing(true);
    setProgress(10);
    setStatus("Preparing files");

    try {
      const finalOptions = { ...defaultOptions, ...options };
      const nextResult = await tool.runBrowser(
        items.map((item) => item.file),
        finalOptions,
        (nextProgress, nextStatus) => {
          setProgress(nextProgress);
          setStatus(nextStatus);
        }
      );
      if (result?.url) URL.revokeObjectURL(result.url);
      setProgress(100);
      setStatus("Done");
      const url = createDownloadUrl(nextResult.blob);
      setResult({ url, name: nextResult.fileName });
    } catch (error) {
      console.error(error);
      setErrorMessage("브라우저 처리 중 오류가 발생했습니다. 파일 형식과 옵션을 확인해 주세요.");
    } finally {
      setProcessing(false);
    }
  };

  const processLocal = async () => {
    if (!tool.runLocal) return;
    if (!localToken) {
      setErrorMessage("로컬 엔진 세션 토큰을 입력해 주세요.");
      return;
    }
    if (items.length === 0) return;

    setErrorMessage("");
    setProcessing(true);
    setProgress(10);
    setStatus("Sending files to local engine");

    try {
      const finalOptions = { ...defaultOptions, ...options };
      const nextResult = await tool.runLocal(
        items.map((item) => item.file),
        finalOptions,
        localToken
      );
      if (result?.url) URL.revokeObjectURL(result.url);
      setProgress(100);
      setStatus("Done");
      const url = createDownloadUrl(nextResult.blob);
      setResult({ url, name: nextResult.fileName });
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : "Local engine error";
      setErrorMessage(
        `로컬 엔진 처리 실패: ${detail}. 엔진 실행 상태, origin 설정, 설치 의존성을 확인해 주세요.`
      );
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
            helper="기본적으로 파일은 브라우저에서만 처리됩니다. 로컬 엔진 사용 시에만 전송됩니다."
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
                고급 변환은 로컬 엔진을 사용하세요. (127.0.0.1:34781, 세션 토큰 필요)
              </p>
              <input
                value={localToken}
                onChange={(event) => setLocalToken(event.target.value)}
                placeholder="Session token"
                className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
          ) : null}
          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
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
                setErrorMessage("");
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
            "What file size limits apply?"
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
