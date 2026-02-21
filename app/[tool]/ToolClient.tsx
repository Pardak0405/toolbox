"use client";

import { useEffect, useMemo, useState } from "react";
import DropzoneUploader from "@/app/_components/DropzoneUploader";
import FileQueue, { FileQueueItem } from "@/app/_components/FileQueue";
import OptionsPanel from "@/app/_components/OptionsPanel";
import PdfPreview from "@/app/_components/PdfPreview";
import ProgressModal from "@/app/_components/ProgressModal";
import ResultPanel from "@/app/_components/ResultPanel";
import AdSlot from "@/app/_components/AdSlot";
import { getRecommendations, getToolBySlug } from "@/tools/registry";
import { createDownloadUrl } from "@/app/_lib/utils";
import { FILE_LIMITS } from "@/config/security";
import { sanitizeFilename, sanitizeText } from "@/lib/sanitize";
import { estimatePdfPages, validateFileTypeSize } from "@/lib/validation";

const multiTools = new Set([
  "merge-pdf",
  "scan-to-pdf",
  "jpg-to-pdf",
  "pdf-to-jpg",
  "compare-pdf"
]);

export default function ToolClient({ toolSlug }: { toolSlug: string }) {
  const resolvedTool = getToolBySlug(toolSlug);
  const [items, setItems] = useState<FileQueueItem[]>([]);
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ url: string; name: string; blob: Blob } | null>(
    null
  );
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showMoreIntro, setShowMoreIntro] = useState(false);
  const [resourceWarning, setResourceWarning] = useState("");
  const [modeNotice, setModeNotice] = useState("");
  const [abortController, setAbortController] = useState<AbortController | null>(
    null
  );

  if (!resolvedTool) throw new Error("Tool not found.");
  const tool = resolvedTool;

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
  const content = tool.content;
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
    const allowed = tool.inputTypes.map((type) => type.toLowerCase());
    const accepted: FileQueueItem[] = [];
    const rejected: string[] = [];

    for (const file of files.slice(0, FILE_LIMITS.maxFilesPerRun)) {
      const checked = validateFileTypeSize(file, allowed, FILE_LIMITS.defaultHardBytes);
      if (!checked.ok) {
        rejected.push(`${sanitizeText(file.name, 60)}: ${checked.reason}`);
        continue;
      }
      const safeName = sanitizeFilename(file.name);
      const normalized = new File([file], safeName, { type: file.type });
      accepted.push({
        id: `${safeName}-${crypto.randomUUID()}`,
        file: normalized
      });
    }

    if (rejected.length > 0) {
      setErrorMessage(rejected.slice(0, 2).join(" / "));
    }
    setItems((prev) => (multiTools.has(tool.id) ? [...prev, ...accepted] : accepted));
  };

  useEffect(() => {
    let mounted = true;
    async function evaluateResourceWarning() {
      if (items.length === 0) {
        setResourceWarning("");
        return;
      }
      const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
      if (totalSize > FILE_LIMITS.defaultSoftBytes * 2) {
        if (mounted) {
          setResourceWarning("파일 용량이 커서 처리 시간이 길어질 수 있습니다. 파일 분할을 권장합니다.");
        }
      }
      if (tool.inputTypes.includes("pdf")) {
        try {
          const pages = await estimatePdfPages(items[0].file);
          if (!mounted) return;
          if (pages > FILE_LIMITS.maxPdfPagesHard) {
            setResourceWarning(
              `PDF 페이지가 ${pages}장으로 많습니다. 일부 브라우저 환경에서 실패할 수 있습니다.`
            );
          } else if (pages > FILE_LIMITS.maxPdfPagesForOcr) {
            setResourceWarning(
              `페이지 수가 ${pages}장입니다. OCR/렌더 작업은 시간이 오래 걸릴 수 있습니다.`
            );
          } else {
            setResourceWarning("");
          }
        } catch {
          // Ignore page estimation failures.
        }
      }
    }
    evaluateResourceWarning();
    return () => {
      mounted = false;
    };
  }, [items, tool.inputTypes]);

  const processBrowser = async () => {
    if (!tool.runBrowser) return;
    if (items.length === 0) return;

    setErrorMessage("");
    setProcessing(true);
    setProgress(10);
    setStatus("Preparing files");
    const controller = new AbortController();
    setAbortController(controller);
    let lastRealProgress = Date.now();
    let hasRealProgress = false;
    const progressTimer = window.setInterval(() => {
      setProgress((prev) => {
        if (hasRealProgress && Date.now() - lastRealProgress < 1200) {
          return prev;
        }
        if (prev >= 85) return prev;
        return prev + 1;
      });
    }, 700);

    try {
      const finalOptions = { ...defaultOptions, ...options };
      const nextResult = await tool.runBrowser(
        items.map((item) => item.file),
        finalOptions,
        (nextProgress, nextStatus) => {
          hasRealProgress = true;
          lastRealProgress = Date.now();
          setProgress(nextProgress);
          setStatus(nextStatus);
        },
        { signal: controller.signal }
      );
      if (nextResult.notice) {
        setModeNotice(nextResult.notice);
      } else if (tool.id === "powerpoint-to-pdf") {
        setModeNotice("브라우저 모드는 일부 폰트/레이아웃이 달라질 수 있습니다.");
      } else {
        setModeNotice("");
      }
      if (result?.url) URL.revokeObjectURL(result.url);
      setProgress(100);
      setStatus("Done");
      const url = createDownloadUrl(nextResult.blob);
      setResult({ url, name: nextResult.fileName, blob: nextResult.blob });
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : "Unknown browser error";
      const lines = [
        `[tool] ${tool.title}`,
        `[status] browser-processing-failed`,
        `[reason] ${detail}`,
        "",
        "The browser fallback report was generated so the task does not stop completely.",
        "Try smaller files, fewer files per run, or different options."
      ];
      const reportBlob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const reportUrl = createDownloadUrl(reportBlob);
      setResult({ url: reportUrl, name: `${tool.slug}-fallback-report.txt`, blob: reportBlob });
      setErrorMessage(`브라우저 처리 실패: ${detail}`);
    } finally {
      window.clearInterval(progressTimer);
      setAbortController(null);
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
            helper="파일은 브라우저에서 처리됩니다. 실패 시 자동으로 fallback 리포트를 생성합니다."
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
          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
          {resourceWarning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {resourceWarning}
            </div>
          ) : null}
          {modeNotice ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {modeNotice}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={processBrowser}
              disabled={items.length === 0 || processing}
              className="btn-primary rounded-full px-6 py-2 text-sm font-semibold"
            >
              {tool.id === "powerpoint-to-pdf" ? "Convert to PDF" : "Run in browser"}
            </button>
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
          {tool.id === "powerpoint-to-pdf" && result && result.blob.type === "application/pdf" ? (
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-sm font-semibold">결과 PDF 미리보기 (첫 페이지)</p>
              <div className="mt-3">
                <PdfPreview file={new File([result.blob], "preview.pdf", { type: "application/pdf" })} />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {content ? (
        <section className="mt-10 space-y-6">
          <article className="rounded-3xl bg-white p-8">
            <h2 className="font-display text-2xl">이 툴은 무엇을 하나요?</h2>
            <div className="mt-4 space-y-3 text-sm text-muted">
              {content.intro
                .split("\n\n")
                .filter(Boolean)
                .slice(0, showMoreIntro ? undefined : 1)
                .map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
            </div>
            <button
              type="button"
              className="mt-3 text-xs font-semibold text-ember"
              onClick={() => setShowMoreIntro((prev) => !prev)}
            >
              {showMoreIntro ? "접기" : "더보기"}
            </button>
            <div className="mt-5">
              <p className="text-sm font-semibold">주요 사용 사례</p>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {content.useCases.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          </article>

          <article className="rounded-3xl bg-white p-8">
            <h2 className="font-display text-2xl">사용 방법</h2>
            <ol className="mt-4 space-y-2 text-sm text-muted">
              {content.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>

          <article className="rounded-3xl bg-white p-8">
            <h2 className="font-display text-2xl">자주 사용하는 옵션 설명</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {content.tips.map((tip) => (
                <li key={tip}>- {tip}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-3xl bg-white p-8">
            <h2 className="font-display text-2xl">보안 안내</h2>
            <p className="mt-4 text-sm text-muted">
              기본 모드는 브라우저 내부 처리입니다. 고품질 변환이나 대용량 문서는 처리
              시간이 길어질 수 있으므로, 필요하면 파일을 분할하거나 옵션을 조정해
              실행하는 것을 권장합니다.
            </p>
          </article>

          <article className="rounded-3xl bg-white p-8">
            <h2 className="font-display text-2xl">FAQ</h2>
            <div className="mt-4 space-y-3">
              {content.faq.map((item) => (
                <details key={item.q} className="rounded-2xl border border-line bg-fog p-4">
                  <summary className="cursor-pointer text-sm font-semibold">{item.q}</summary>
                  <p className="mt-2 text-sm text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </article>

          <article className="rounded-3xl bg-white p-8">
            <h2 className="font-display text-2xl">관련 툴</h2>
            <p className="mt-4 text-xs font-semibold text-muted">같은 카테고리 추천</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recommendations.map((item) => (
                <a
                  key={item.id}
                  href={`/${item.slug}`}
                  className="rounded-full border border-line px-3 py-1 text-xs hover:border-ember"
                >
                  {item.title}
                </a>
              ))}
            </div>
            <p className="mt-5 text-xs font-semibold text-muted">관련 작업 추천</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {content.related.map((slug) => {
                const relatedTool = getToolBySlug(slug);
                return (
                  <a
                    key={slug}
                    href={`/${slug}`}
                    className="rounded-full border border-line px-3 py-1 text-xs hover:border-ember"
                  >
                    {relatedTool?.title ?? slug}
                  </a>
                );
              })}
            </div>
          </article>
        </section>
      ) : null}

      <ProgressModal
        open={processing}
        progress={progress}
        status={status}
        onCancel={() => {
          abortController?.abort();
          setProcessing(false);
        }}
      />
    </div>
  );
}
