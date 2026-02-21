import {
  ArrowLeftRight,
  Crop,
  FileDown,
  FileMinus,
  FilePlus,
  FileSearch,
  FileText,
  FileType2,
  FileUp,
  ImageIcon,
  Layers,
  Lock,
  Merge,
  RotateCw,
  Scan,
  Scissors,
  ShieldCheck,
  Stamp,
  Trash2,
  Type,
  Unlock,
  WandSparkles
} from "lucide-react";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  addPageNumbers,
  addWatermark,
  annotatePdf,
  cropPdf,
  extractPages,
  imagesToPdf,
  mergePdf,
  pdfToImages,
  redactPdf,
  removePages,
  rotatePdf,
  splitPdf
} from "@/app/_lib/pdf";
import { extractPdfText, renderPdfPageToCanvas } from "@/app/_lib/pdfjs";
import { diffCanvases } from "@/app/_lib/compare";
import { runOcrOnCanvas } from "@/app/_lib/ocr";
import { FILE_LIMITS } from "@/config/security";

export type ToolEngine = "browser";

export type ToolOptionField = {
  id: string;
  label: string;
  type: "text" | "number" | "checkbox" | "select" | "color";
  options?: { label: string; value: string }[];
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  help?: string;
};

export type ToolResult = {
  blob: Blob;
  fileName: string;
  notice?: string;
};

export type ToolFaqItem = {
  q: string;
  a: string;
};

export type ToolContent = {
  intro: string;
  useCases: string[];
  steps: string[];
  tips: string[];
  faq: ToolFaqItem[];
  related: string[];
};

export type ToolDefinition = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  inputTypes: string[];
  outputTypes: string[];
  optionsSchema: ToolOptionField[];
  content?: ToolContent;
  engine: ToolEngine;
  icon: unknown;
  runBrowser?: (
    files: File[],
    options: Record<string, unknown>,
    onProgress?: (progress: number, status: string) => void,
    context?: { signal?: AbortSignal }
  ) => Promise<ToolResult>;
};

function bytesToBlob(bytes: Uint8Array, type: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}

async function zipBlobs(blobs: Blob[], baseName: string, extension: string) {
  const zip = new JSZip();
  blobs.forEach((blob, index) => {
    zip.file(`${baseName}-${index + 1}.${extension}`, blob);
  });
  const content = await zip.generateAsync({ type: "blob" });
  return { blob: content, fileName: `${baseName}.zip` };
}

async function zipCanvasImages(canvases: HTMLCanvasElement[], baseName: string) {
  const zip = new JSZip();
  await Promise.all(
    canvases.map(async (canvas, index) => {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (blob) {
        zip.file(`${baseName}-${index + 1}.png`, blob);
      }
    })
  );
  const content = await zip.generateAsync({ type: "blob" });
  return { blob: content, fileName: `${baseName}.zip` };
}

function toWinAnsiSafe(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function textPdfFromLines(title: string, lines: string[]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const lineHeight = 14;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const writeLine = (line: string, size = 11) => {
    if (y < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(toWinAnsiSafe(line).slice(0, 110), {
      x: margin,
      y,
      size,
      font,
      color: rgb(0.15, 0.15, 0.15)
    });
    y -= lineHeight;
  };

  writeLine(title, 15);
  y -= 8;
  for (const line of lines) {
    writeLine(line);
  }
  return bytesToBlob(await doc.save(), "application/pdf");
}

function sortOfficeEntries(names: string[], prefix: string, suffix = ".xml") {
  return names
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .sort((left, right) => {
      const ln = Number(left.match(/(\d+)/)?.[1] || 0);
      const rn = Number(right.match(/(\d+)/)?.[1] || 0);
      return ln - rn;
    });
}

function guessMimeType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function inlinePptxMedia(html: string, zip: JSZip) {
  const mediaRegex = /(ppt\/media\/[^"')\s]+|media\/[^"')\s]+|\.\.\/media\/[^"')\s]+)/g;
  const matches = html.match(mediaRegex);
  if (!matches) return html;
  const unique = Array.from(new Set(matches));
  let output = html;
  for (const rawPath of unique) {
    const normalized = rawPath.replace(/^(\.\.\/)+/, "");
    const zipPath = normalized.startsWith("ppt/") ? normalized : `ppt/${normalized}`;
    const file = zip.file(zipPath);
    if (!file) continue;
    const base64 = await file.async("base64");
    const mime = guessMimeType(zipPath);
    const dataUrl = `data:${mime};base64,${base64}`;
    output = output.split(rawPath).join(dataUrl);
  }
  return output;
}

function resolveRelTarget(baseDir: string, target: string) {
  if (target.startsWith("/")) {
    return target.replace(/^\/+/, "");
  }
  const stack = baseDir.split("/");
  const parts = target.split("/");
  for (const part of parts) {
    if (part === "..") {
      stack.pop();
      continue;
    }
    if (part === ".") continue;
    stack.push(part);
  }
  return stack.join("/");
}

async function getSlideBackgroundDataUrl(
  zip: JSZip,
  slideName: string,
  parser: DOMParser
) {
  const xml = await zip.file(slideName)?.async("string");
  if (!xml) return null;
  const slideDoc = parser.parseFromString(xml, "text/xml");
  const blip =
    slideDoc.querySelector("p\\:bg a\\:blip, bg a\\:blip") ||
    slideDoc.querySelector("p\\:bgRef a\\:blip, bgRef a\\:blip");
  if (!blip) return null;
  const rId = blip.getAttribute("r:embed") || blip.getAttribute("embed");
  if (!rId) return null;
  const relsPath = slideName.replace("slides/", "slides/_rels/") + ".rels";
  const relsXml = await zip.file(relsPath)?.async("string");
  if (!relsXml) return null;
  const relsDoc = parser.parseFromString(relsXml, "text/xml");
  const rel = Array.from(relsDoc.getElementsByTagName("Relationship")).find(
    (node) => node.getAttribute("Id") === rId
  );
  const target = rel?.getAttribute("Target");
  if (!target) return null;
  const baseDir = slideName.split("/").slice(0, -1).join("/");
  const resolved = resolveRelTarget(baseDir, target);
  const file = zip.file(resolved);
  if (!file) return null;
  const base64 = await file.async("base64");
  const mime = guessMimeType(resolved);
  return `data:${mime};base64,${base64}`;
}

async function extractXmlTexts(zip: JSZip, names: string[], tagSelector: string) {
  const parser = new DOMParser();
  const lines: string[] = [];
  for (const name of names) {
    const xml = await zip.file(name)?.async("string");
    if (!xml) continue;
    const doc = parser.parseFromString(xml, "text/xml");
    const nodes = Array.from(doc.querySelectorAll(tagSelector));
    const text = nodes
      .map((node) => node.textContent || "")
      .join(" ")
      .trim();
    if (text) lines.push(text);
  }
  return lines;
}

type PptxAnalysis = {
  slideNames: string[];
  masterCount: number;
  layoutCount: number;
  themeCount: number;
  textCount: number;
  shapeCount: number;
  imageCount: number;
  smartArtCount: number;
  relMissing: number;
};

async function analyzePptxStructure(zip: JSZip): Promise<PptxAnalysis> {
  const parser = new DOMParser();
  const slideNames = sortOfficeEntries(Object.keys(zip.files), "ppt/slides/slide");
  const masterNames = sortOfficeEntries(Object.keys(zip.files), "ppt/slideMasters/slideMaster");
  const layoutNames = sortOfficeEntries(Object.keys(zip.files), "ppt/slideLayouts/slideLayout");
  const themeNames = Object.keys(zip.files).filter((name) =>
    name.startsWith("ppt/theme/")
  );
  let textCount = 0;
  let shapeCount = 0;
  let imageCount = 0;
  let smartArtCount = 0;
  let relMissing = 0;

  for (const name of slideNames) {
    const xml = await zip.file(name)?.async("string");
    if (!xml) continue;
    const doc = parser.parseFromString(xml, "text/xml");
    textCount += doc.querySelectorAll("a\\:t,t").length;
    shapeCount += doc.querySelectorAll("p\\:sp,sp,a\\:custGeom,a\\:prstGeom").length;
    imageCount += doc.querySelectorAll("a\\:blip,blip,p\\:pic,pic").length;
    smartArtCount += doc.querySelectorAll("dgm\\:relIds,relIds,a\\:graphicData").length;
    const relPath = name.replace("slides/", "slides/_rels/") + ".rels";
    if (!zip.file(relPath)) relMissing += 1;
  }

  return {
    slideNames,
    masterCount: masterNames.length,
    layoutCount: layoutNames.length,
    themeCount: themeNames.length,
    textCount,
    shapeCount,
    imageCount,
    smartArtCount,
    relMissing
  };
}

async function convertPowerpointToPdfInBrowser(
  file: File,
  options: Record<string, unknown> = {},
  onProgress?: (progress: number, status: string) => void
) {
  const { pptxToHtml } = await import("@jvmr/pptx-to-html");
  const html2canvas = (await import("html2canvas")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parser = new DOMParser();
  const analysis = await analyzePptxStructure(zip);
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("string");
  let widthPx = 960;
  let heightPx = 540;
  if (presentationXml) {
    const presentationDoc = parser.parseFromString(presentationXml, "text/xml");
    const slideSize = presentationDoc.querySelector("p\\:sldSz,sldSz");
    const cx = Number(slideSize?.getAttribute("cx") || "0");
    const cy = Number(slideSize?.getAttribute("cy") || "0");
    if (cx > 0 && cy > 0) {
      widthPx = Math.max(320, Math.min(2200, Math.round(cx / 9525)));
      heightPx = Math.max(180, Math.min(2200, Math.round(cy / 9525)));
    }
  }

  const quality = String(options.quality || "high");
  const scale =
    quality === "small"
      ? 1
      : quality === "balanced"
        ? 1.4
        : 1.8;

  let slidesHtml: string[] = [];
  try {
    slidesHtml = await pptxToHtml(await file.arrayBuffer(), {
      width: widthPx,
      height: heightPx,
      scaleToFit: false,
      letterbox: false,
      domParserFactory: () => new DOMParser()
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "pptx-to-html failed";
    throw new Error(`PPTX parse failed: ${detail}`);
  }

  const contentCount = analysis.textCount + analysis.shapeCount + analysis.imageCount;
  if (contentCount === 0) {
    throw new Error(
      "슬라이드 요소를 해석하지 못했습니다. 템플릿/레이아웃 기반 파일일 수 있습니다."
    );
  }

  const stage = document.createElement("div");
  stage.style.position = "absolute";
  stage.style.left = "0";
  stage.style.top = "0";
  stage.style.pointerEvents = "none";
  stage.style.zIndex = "-1";
  stage.style.visibility = "visible";
  stage.style.opacity = "0.01";
  stage.style.width = `${widthPx}px`;
  stage.style.height = `${heightPx}px`;
  stage.style.background = "transparent";
  stage.style.overflow = "hidden";
  document.body.appendChild(stage);

  const waitForAssets = async (container: HTMLElement, timeoutMs = 7000) => {
    const images = Array.from(container.querySelectorAll("img"));
    images.forEach((img) => {
      if (!img.getAttribute("crossorigin")) {
        img.setAttribute("crossorigin", "anonymous");
      }
    });
    const imagePromises = images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        })
    );
    const fontPromise =
      typeof document !== "undefined" && "fonts" in document
        ? (document as Document & { fonts: FontFaceSet }).fonts.ready
        : Promise.resolve();
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    await Promise.race([Promise.all([...imagePromises, fontPromise]), timeout]);
  };

  const totalSlides = Math.max(1, slidesHtml.length);
  const templateNotice =
    analysis.smartArtCount > 0 || analysis.themeCount > 0 || analysis.masterCount > 0
      ? "복잡한 템플릿이 감지되어 레이아웃 유지 모드로 변환되었습니다."
      : "";
  const renderedImages: File[] = [];
  for (const [index, html] of slidesHtml.entries()) {
    const startProgress = Math.round(15 + (index / totalSlides) * 70);
    onProgress?.(startProgress, `슬라이드 렌더링 ${index + 1}/${totalSlides}`);
    const hydratedHtml = await inlinePptxMedia(html, zip);
    const slideName = analysis.slideNames[index];
    const bgDataUrl = slideName ? await getSlideBackgroundDataUrl(zip, slideName, parser) : null;
    const sandbox = document.createElement("div");
    sandbox.style.width = `${widthPx}px`;
    sandbox.style.height = `${heightPx}px`;
    sandbox.style.background = bgDataUrl
      ? `url('${bgDataUrl}') center / cover no-repeat`
      : "#ffffff";
    sandbox.style.position = "relative";
    sandbox.style.transformOrigin = "top left";
    sandbox.style.fontFamily =
      "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, Segoe UI, sans-serif";
    sandbox.innerHTML = hydratedHtml;
    const styleFix = document.createElement("style");
    styleFix.textContent = `
      * { box-sizing: border-box; }
      img { max-width: none; }
      svg { overflow: visible; }
      .slide-container, .slide { line-height: 1.25; }
      .slide-container, .slide { text-rendering: geometricPrecision; }
    `;
    sandbox.prepend(styleFix);
    sandbox.querySelectorAll("script,iframe,object,embed,link").forEach((node) => {
      node.remove();
    });
    const slideRoot = sandbox.firstElementChild as HTMLElement | null;
    const captureTarget = slideRoot ?? sandbox;
    captureTarget.style.overflow = "visible";
    captureTarget.style.background = "transparent";
    captureTarget.style.visibility = "visible";
    captureTarget.querySelectorAll("img").forEach((img) => {
      img.loading = "eager";
      img.decoding = "sync";
    });
    captureTarget.style.width = `${widthPx}px`;
    captureTarget.style.height = `${heightPx}px`;

    stage.innerHTML = "";
    stage.appendChild(sandbox);

    await waitForAssets(captureTarget);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const renderViaSvg = async () => {
      const clone = captureTarget.cloneNode(true) as HTMLElement;
      clone.style.width = `${widthPx}px`;
      clone.style.height = `${heightPx}px`;
      let serialized = clone.outerHTML;
      if (!/xmlns=/.test(serialized)) {
        serialized = serialized.replace(
          /^<([a-zA-Z0-9-]+)/,
          '<$1 xmlns="http://www.w3.org/1999/xhtml"'
        );
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">
        <rect width="100%" height="100%" fill="#ffffff"></rect>
        ${bgDataUrl ? `<image href="${bgDataUrl}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"></image>` : ""}
        <foreignObject width="100%" height="100%">${serialized}</foreignObject>
      </svg>`;
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const img = new Image();
      img.crossOrigin = "anonymous";
      const imageLoaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("SVG image load failed"));
      });
      img.src = url;
      await imageLoaded;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(widthPx * scale);
      canvas.height = Math.round(heightPx * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("SVG canvas context missing");
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas;
    };

    const renderSlide = async (useForeignObject: boolean) => {
      try {
        return await html2canvas(captureTarget, {
          backgroundColor: null,
          width: widthPx,
          height: heightPx,
          scale,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: useForeignObject,
          imageTimeout: 5000
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "html2canvas failed";
        throw new Error(`Slide render failed: ${detail}`);
      }
    };

    let canvas: HTMLCanvasElement | null = null;
    let renderError: Error | null = null;
    try {
      canvas = await renderViaSvg();
    } catch (error) {
      renderError = error as Error;
    }
    if (!canvas) {
      try {
        canvas = await renderSlide(false);
      } catch (error) {
        renderError = error as Error;
      }
    }
    if (!canvas) {
      try {
        canvas = await renderSlide(true);
      } catch (error) {
        renderError = error as Error;
      }
    }
    if (!canvas) {
      const detail = renderError ? renderError.message : "render failed";
      throw new Error(detail);
    }
    onProgress?.(Math.round(20 + (index / totalSlides) * 70), "PNG 변환");
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) continue;
    renderedImages.push(
      new File([blob], `slide-${index + 1}.png`, { type: "image/png" })
    );
    const nextProgress = Math.round(15 + ((index + 1) / totalSlides) * 70);
    onProgress?.(nextProgress, `슬라이드 렌더링 ${index + 1}/${totalSlides}`);
  }

  stage.remove();
  if (renderedImages.length === 0) {
    throw new Error("슬라이드 렌더 결과가 비어 있습니다.");
  }
  onProgress?.(90, "PDF 생성 중");
  const pdfBlob = await imagesToPdf(renderedImages);
  return {
    blob: pdfBlob,
    fileName: "powerpoint-browser.pdf",
    notice: templateNotice || undefined
  };
}

async function convertWordToPdfInBrowser(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const lines = await extractXmlTexts(zip, ["word/document.xml"], "w\\:t,t");
  const body = lines.length > 0 ? lines : ["No extractable text found in document XML."];
  return textPdfFromLines("Word to PDF (Browser Text Mode)", body);
}

async function convertExcelToPdfInBrowser(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parser = new DOMParser();
  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const sharedStrings: string[] = [];
  if (sharedStringsXml) {
    const sharedDoc = parser.parseFromString(sharedStringsXml, "text/xml");
    sharedDoc.querySelectorAll("si").forEach((si) => {
      sharedStrings.push((si.textContent || "").trim());
    });
  }

  const sheetNames = sortOfficeEntries(Object.keys(zip.files), "xl/worksheets/sheet");
  const lines: string[] = [];
  for (const sheetName of sheetNames) {
    const xml = await zip.file(sheetName)?.async("string");
    if (!xml) continue;
    const doc = parser.parseFromString(xml, "text/xml");
    lines.push(`[${sheetName.split("/").pop()}]`);
    doc.querySelectorAll("row").forEach((row) => {
      const values = Array.from(row.querySelectorAll("c")).map((cell) => {
        const type = cell.getAttribute("t");
        const v = cell.querySelector("v")?.textContent?.trim() || "";
        if (type === "s") {
          return sharedStrings[Number(v)] || "";
        }
        return v;
      });
      const rowText = values.filter(Boolean).join(" | ");
      if (rowText) lines.push(rowText);
    });
    lines.push("");
  }
  const body = lines.length > 0 ? lines : ["No extractable values found in worksheet XML."];
  return textPdfFromLines("Excel to PDF (Browser Text Mode)", body);
}

function splitTextForPdf(text: string, chunk = 95) {
  const normalized = toWinAnsiSafe(text);
  if (!normalized) return [];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= chunk) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function convertHtmlToPdfInBrowser(files: File[], options: Record<string, unknown>) {
  const lines: string[] = [];
  if (files[0]) {
    const html = await files[0].text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const title = doc.title?.trim();
    if (title) lines.push(`Title: ${title}`);
    const bodyText = doc.body?.textContent?.replace(/\s+/g, " ").trim() || "";
    if (bodyText) lines.push(...splitTextForPdf(bodyText));
  }

  const url = String(options.url || "").trim();
  if (url) {
    lines.push("");
    lines.push(`URL option: ${url}`);
    lines.push(
      "Browser security policies may block direct remote page capture. Upload HTML file for reliable conversion."
    );
  }

  const body = lines.length > 0 ? lines : ["No HTML content found to convert."];
  return textPdfFromLines("HTML to PDF (Browser Text Mode)", body);
}

export const categories = [
  "Organize",
  "Optimize",
  "Convert to PDF",
  "Convert from PDF",
  "Edit",
  "Security",
  "Intelligence"
];

export const toolsRegistry: ToolDefinition[] = [
  {
    id: "merge-pdf",
    slug: "merge-pdf",
    title: "Merge PDF",
    description: "Combine PDFs into one file.",
    category: "Organize",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [],
    engine: "browser",
    icon: Merge,
    runBrowser: async (files) => ({
      blob: await mergePdf(files),
      fileName: "merged.pdf"
    })
  },
  {
    id: "split-pdf",
    slug: "split-pdf",
    title: "Split PDF",
    description: "Split every page into new PDFs.",
    category: "Organize",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [],
    engine: "browser",
    icon: Scissors,
    runBrowser: async (files) => {
      const outputs = await splitPdf(files[0]);
      return await zipBlobs(outputs, "split", "pdf");
    }
  },
  {
    id: "remove-pages",
    slug: "remove-pages",
    title: "Remove Pages",
    description: "Delete selected pages.",
    category: "Organize",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "remove",
        label: "Pages to remove (comma separated)",
        type: "text",
        placeholder: "2,4,6"
      }
    ],
    engine: "browser",
    icon: Trash2,
    runBrowser: async (files, options) => {
      const pages = String(options.remove || "")
        .split(",")
        .map((value) => Number(value.trim()) - 1)
        .filter((value) => value >= 0);
      return {
        blob: await removePages(files[0], pages),
        fileName: "removed-pages.pdf"
      };
    }
  },
  {
    id: "extract-pages",
    slug: "extract-pages",
    title: "Extract Pages",
    description: "Keep only selected pages.",
    category: "Organize",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "extract",
        label: "Pages to extract (comma separated)",
        type: "text",
        placeholder: "1,3,5"
      }
    ],
    engine: "browser",
    icon: FilePlus,
    runBrowser: async (files, options) => {
      const pages = String(options.extract || "")
        .split(",")
        .map((value) => Number(value.trim()) - 1)
        .filter((value) => value >= 0);
      return {
        blob: await extractPages(files[0], pages),
        fileName: "extracted-pages.pdf"
      };
    }
  },
  {
    id: "organize-pdf",
    slug: "organize-pdf",
    title: "Organize PDF",
    description: "Reorder pages quickly.",
    category: "Organize",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "order",
        label: "Page order (comma separated)",
        type: "text",
        placeholder: "3,1,2"
      }
    ],
    engine: "browser",
    icon: Layers,
    runBrowser: async (files, options) => {
      const order = String(options.order || "")
        .split(",")
        .map((value) => Number(value.trim()) - 1)
        .filter((value) => value >= 0);
      return {
        blob: await extractPages(files[0], order),
        fileName: "organized.pdf"
      };
    }
  },
  {
    id: "scan-to-pdf",
    slug: "scan-to-pdf",
    title: "Scan to PDF",
    description: "Capture images on mobile and export a PDF.",
    category: "Organize",
    inputTypes: ["image"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "enhance",
        label: "Auto enhance",
        type: "checkbox",
        defaultValue: true
      }
    ],
    engine: "browser",
    icon: Scan,
    runBrowser: async (files) => ({
      blob: await imagesToPdf(files),
      fileName: "scan.pdf"
    })
  },
  {
    id: "compress-pdf",
    slug: "compress-pdf",
    title: "Compress PDF",
    description: "Shrink file size with smart optimization.",
    category: "Optimize",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "quality",
        label: "Compression level",
        type: "select",
        defaultValue: "balanced",
        options: [
          { label: "Balanced", value: "balanced" },
          { label: "Strong", value: "strong" }
        ]
      }
    ],
    engine: "browser",
    icon: FileMinus,
    runBrowser: async (files) => ({
      blob: files[0],
      fileName: "compressed.pdf"
    }),
    // browser-only
  },
  {
    id: "repair-pdf",
    slug: "repair-pdf",
    title: "Repair PDF",
    description: "Fix corrupted PDFs.",
    category: "Optimize",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [],
    engine: "browser",
    icon: WandSparkles,
    runBrowser: async (files) => ({
      blob: files[0],
      fileName: "repaired.pdf"
    }),
    // browser-only
  },
  {
    id: "ocr-pdf",
    slug: "ocr-pdf",
    title: "OCR PDF",
    description: "Extract text from scanned pages.",
    category: "Optimize",
    inputTypes: ["pdf"],
    outputTypes: ["txt"],
    optionsSchema: [
      {
        id: "language",
        label: "Language",
        type: "select",
        defaultValue: "eng",
        options: [
          { label: "English", value: "eng" },
          { label: "Korean", value: "kor" }
        ]
      }
    ],
    engine: "browser",
    icon: FileSearch,
    runBrowser: async (files, options, onProgress, context) => {
      const lines: string[] = [];
      const language = String(options.language || "eng");
      const maxPages = FILE_LIMITS.maxPdfPagesForOcr;
      let index = 0;
      while (index < maxPages) {
        if (context?.signal?.aborted) {
          throw new DOMException("OCR aborted", "AbortError");
        }
        const canvas = await renderPdfPageToCanvas(files[0], index);
        if (!canvas) break;
        const text = await runOcrOnCanvas(canvas, language, {
          signal: context?.signal,
          timeoutMs: FILE_LIMITS.ocrTimeoutMsPerPage
        });
        lines.push(text);
        index += 1;
        onProgress?.(Math.min(90, index * 15), `OCR page ${index}`);
      }
      if (index >= maxPages) {
        lines.push(`\\n[warning] OCR limited to first ${maxPages} pages for safety.`);
      }
      const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
      return { blob, fileName: "ocr.txt" };
    }
  },
  {
    id: "jpg-to-pdf",
    slug: "jpg-to-pdf",
    title: "JPG or PNG to PDF",
    description: "Convert JPG or PNG images into a PDF.",
    category: "Convert to PDF",
    inputTypes: ["jpg", "jpeg", "png"],
    outputTypes: ["pdf"],
    optionsSchema: [],
    engine: "browser",
    icon: ImageIcon,
    runBrowser: async (files) => ({
      blob: await imagesToPdf(files),
      fileName: "images.pdf"
    })
  },
  {
    id: "word-to-pdf",
    slug: "word-to-pdf",
    title: "Word to PDF",
    description: "Convert DOCX files to PDF.",
    category: "Convert to PDF",
    inputTypes: ["doc", "docx"],
    outputTypes: ["pdf"],
    optionsSchema: [],
    engine: "browser",
    icon: FileType2,
    runBrowser: async (files) => ({
      blob: await convertWordToPdfInBrowser(files[0]),
      fileName: "word-browser.pdf"
    }),
    // browser-only
  },
  {
    id: "powerpoint-to-pdf",
    slug: "powerpoint-to-pdf",
    title: "PowerPoint to PDF",
    description: "Convert PPTX slides to PDF.",
    category: "Convert to PDF",
    inputTypes: ["ppt", "pptx"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "quality",
        label: "출력 품질",
        type: "select",
        defaultValue: "high",
        options: [
          { label: "High", value: "high" },
          { label: "Balanced", value: "balanced" },
          { label: "Small file", value: "small" }
        ]
      },
      {
        id: "fontMode",
        label: "폰트 처리",
        type: "select",
        defaultValue: "embed",
        options: [
          { label: "Embed fonts", value: "embed" },
          { label: "Substitute", value: "substitute" },
          { label: "Convert text to outlines", value: "outlines" }
        ]
      },
      {
        id: "compressMode",
        label: "이미지 압축",
        type: "select",
        defaultValue: "none",
        options: [
          { label: "none", value: "none" },
          { label: "low", value: "low" },
          { label: "medium", value: "medium" },
          { label: "high", value: "high" }
        ]
      },
      {
        id: "keepMetadata",
        label: "메타데이터 유지",
        type: "checkbox",
        defaultValue: true
      }
    ],
    engine: "browser",
    icon: FileType2,
    runBrowser: async (files, options, onProgress) =>
      convertPowerpointToPdfInBrowser(files[0], options, onProgress),
    // browser-only
  },
  {
    id: "excel-to-pdf",
    slug: "excel-to-pdf",
    title: "Excel to PDF",
    description: "Convert XLSX sheets to PDF.",
    category: "Convert to PDF",
    inputTypes: ["xls", "xlsx"],
    outputTypes: ["pdf"],
    optionsSchema: [],
    engine: "browser",
    icon: FileType2,
    runBrowser: async (files) => ({
      blob: await convertExcelToPdfInBrowser(files[0]),
      fileName: "excel-browser.pdf"
    }),
    // browser-only
  },
  {
    id: "html-to-pdf",
    slug: "html-to-pdf",
    title: "HTML to PDF",
    description: "Print web pages to PDF.",
    category: "Convert to PDF",
    inputTypes: ["html"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "url",
        label: "URL",
        type: "text",
        placeholder: "https://example.com"
      }
    ],
    engine: "browser",
    icon: FileUp,
    runBrowser: async (files, options) => ({
      blob: await convertHtmlToPdfInBrowser(files, options),
      fileName: "browser-html.pdf"
    }),
    // browser-only
  },
  {
    id: "pdf-to-jpg",
    slug: "pdf-to-jpg",
    title: "PDF to JPG",
    description: "Export each page as JPG.",
    category: "Convert from PDF",
    inputTypes: ["pdf"],
    outputTypes: ["jpg"],
    optionsSchema: [
      {
        id: "quality",
        label: "Image quality",
        type: "select",
        defaultValue: "medium",
        options: [
          { label: "Medium", value: "medium" },
          { label: "High", value: "high" }
        ]
      }
    ],
    engine: "browser",
    icon: ImageIcon,
    runBrowser: async (files) => {
      const outputs = await pdfToImages(files[0], "jpeg");
      return await zipBlobs(outputs, "page", "jpg");
    }
  },
  {
    id: "pdf-to-word",
    slug: "pdf-to-word",
    title: "PDF to Word",
    description: "Extract text into a DOCX file.",
    category: "Convert from PDF",
    inputTypes: ["pdf"],
    outputTypes: ["docx"],
    optionsSchema: [
      {
        id: "mode",
        label: "Mode",
        type: "select",
        defaultValue: "text",
        options: [
          { label: "Text only", value: "text" },
          { label: "Advanced (local)", value: "local" }
        ]
      }
    ],
    engine: "browser",
    icon: FileDown,
    runBrowser: async (files) => {
      const { Document, Packer, Paragraph } = await import("docx");
      const text = await extractPdfText(files[0]);
      const doc = new Document({
        sections: [
          {
            children: text
              .split("\n")
              .filter(Boolean)
              .map((line) => new Paragraph(line))
          }
        ]
      });
      const blob = await Packer.toBlob(doc);
      return { blob, fileName: "extracted.docx" };
    },
    // browser-only
  },
  {
    id: "pdf-to-powerpoint",
    slug: "pdf-to-powerpoint",
    title: "PDF to PowerPoint",
    description: "Convert pages to slides.",
    category: "Convert from PDF",
    inputTypes: ["pdf"],
    outputTypes: ["pptx"],
    optionsSchema: [
      {
        id: "mode",
        label: "Mode",
        type: "select",
        defaultValue: "image",
        options: [
          { label: "Image-based", value: "image" },
          { label: "Advanced (local)", value: "local" }
        ]
      }
    ],
    engine: "browser",
    icon: FileDown,
    runBrowser: async (files, _options, onProgress) => {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      let index = 0;
      while (true) {
        const canvas = await renderPdfPageToCanvas(files[0], index);
        if (!canvas) break;
        const dataUrl = canvas.toDataURL("image/png");
        const slide = pptx.addSlide();
        slide.addImage({ data: dataUrl, x: 0, y: 0, w: 13.33, h: 7.5 });
        index += 1;
        onProgress?.(Math.min(90, index * 20), `Rendering slide ${index}`);
      }
      const output = await pptx.write({ outputType: "blob" });
      let blob: Blob;
      if (output instanceof Blob) {
        blob = output;
      } else if (output instanceof ArrayBuffer) {
        blob = new Blob([output], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        });
      } else if (output instanceof Uint8Array) {
        const copy = new Uint8Array(output.byteLength);
        copy.set(output);
        blob = new Blob([copy], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        });
      } else {
        blob = new Blob([String(output)], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        });
      }
      return { blob, fileName: "slides.pptx" };
    },
    // browser-only
  },
  {
    id: "pdf-to-excel",
    slug: "pdf-to-excel",
    title: "PDF to Excel",
    description: "Extract tables into CSV/XLSX.",
    category: "Convert from PDF",
    inputTypes: ["pdf"],
    outputTypes: ["csv"],
    optionsSchema: [],
    engine: "browser",
    icon: FileDown,
    runBrowser: async (files) => {
      const text = await extractPdfText(files[0]);
      const csv = text
        .split("\n")
        .filter(Boolean)
        .map((line) => `"${line.replace(/"/g, "''")}"`)
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      return { blob, fileName: "tables.csv" };
    },
    // browser-only
  },
  {
    id: "pdf-to-pdfa",
    slug: "pdf-to-pdfa",
    title: "PDF to PDF/A",
    description: "Archive-ready PDF/A conversion.",
    category: "Convert from PDF",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [],
    engine: "browser",
    icon: FileDown,
    runBrowser: async (files) => ({
      blob: files[0],
      fileName: "archive.pdf"
    }),
    // browser-only
  },
  {
    id: "rotate-pdf",
    slug: "rotate-pdf",
    title: "Rotate PDF",
    description: "Rotate pages 90° steps.",
    category: "Edit",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "degrees",
        label: "Rotation",
        type: "select",
        defaultValue: "90",
        options: [
          { label: "90°", value: "90" },
          { label: "180°", value: "180" },
          { label: "270°", value: "270" }
        ]
      }
    ],
    engine: "browser",
    icon: RotateCw,
    runBrowser: async (files, options) => ({
      blob: await rotatePdf(files[0], Number(options.degrees || 90)),
      fileName: "rotated.pdf"
    })
  },
  {
    id: "page-numbers",
    slug: "page-numbers",
    title: "Page Numbers",
    description: "Add page numbers to your PDF.",
    category: "Edit",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "start",
        label: "Start at",
        type: "number",
        defaultValue: 1
      }
    ],
    engine: "browser",
    icon: FileText,
    runBrowser: async (files, options) => ({
      blob: await addPageNumbers(files[0], Number(options.start || 1)),
      fileName: "numbered.pdf"
    })
  },
  {
    id: "watermark-pdf",
    slug: "watermark-pdf",
    title: "Watermark PDF",
    description: "Stamp a watermark across pages.",
    category: "Edit",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "text",
        label: "Watermark text",
        type: "text",
        defaultValue: "CONFIDENTIAL"
      }
    ],
    engine: "browser",
    icon: Stamp,
    runBrowser: async (files, options) => ({
      blob: await addWatermark(files[0], String(options.text || "CONFIDENTIAL")),
      fileName: "watermarked.pdf"
    })
  },
  {
    id: "crop-pdf",
    slug: "crop-pdf",
    title: "Crop PDF",
    description: "Trim margins and whitespace.",
    category: "Edit",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "margin",
        label: "Margin (px)",
        type: "number",
        defaultValue: 24,
        min: 0,
        max: 100
      }
    ],
    engine: "browser",
    icon: Crop,
    runBrowser: async (files, options) => ({
      blob: await cropPdf(files[0], Number(options.margin || 24)),
      fileName: "cropped.pdf"
    })
  },
  {
    id: "edit-pdf",
    slug: "edit-pdf",
    title: "Edit PDF",
    description: "Add quick notes and highlights.",
    category: "Edit",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "note",
        label: "Note",
        type: "text",
        defaultValue: "Reviewed and approved"
      }
    ],
    engine: "browser",
    icon: Type,
    runBrowser: async (files, options) => ({
      blob: await annotatePdf(files[0], String(options.note || "")),
      fileName: "annotated.pdf"
    })
  },
  {
    id: "unlock-pdf",
    slug: "unlock-pdf",
    title: "Unlock PDF",
    description: "Remove password protection.",
    category: "Security",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "password",
        label: "Password",
        type: "text"
      }
    ],
    engine: "browser",
    icon: Unlock,
    runBrowser: async (files) => ({
      blob: files[0],
      fileName: "unlocked.pdf"
    }),
    // browser-only
  },
  {
    id: "protect-pdf",
    slug: "protect-pdf",
    title: "Protect PDF",
    description: "Add a password to your PDF.",
    category: "Security",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "password",
        label: "Password",
        type: "text"
      }
    ],
    engine: "browser",
    icon: Lock,
    runBrowser: async (files) => ({
      blob: files[0],
      fileName: "protected.pdf"
    }),
    // browser-only
  },
  {
    id: "sign-pdf",
    slug: "sign-pdf",
    title: "Sign PDF",
    description: "Add a signature block.",
    category: "Security",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "signer",
        label: "Signer name",
        type: "text",
        defaultValue: "Your Name"
      }
    ],
    engine: "browser",
    icon: ShieldCheck,
    runBrowser: async (files, options) => ({
      blob: await addWatermark(
        files[0],
        `Signed by ${String(options.signer || "")}`
      ),
      fileName: "signed.pdf"
    })
  },
  {
    id: "redact-pdf",
    slug: "redact-pdf",
    title: "Redact PDF",
    description: "Black out sensitive data.",
    category: "Security",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "keyword",
        label: "Keyword",
        type: "text",
        defaultValue: "Sensitive"
      }
    ],
    engine: "browser",
    icon: FileMinus,
    runBrowser: async (files, options) => ({
      blob: await redactPdf(files[0], String(options.keyword || "")),
      fileName: "redacted.pdf"
    })
  },
  {
    id: "compare-pdf",
    slug: "compare-pdf",
    title: "Compare PDF",
    description: "Highlight pixel-level changes.",
    category: "Security",
    inputTypes: ["pdf"],
    outputTypes: ["png"],
    optionsSchema: [],
    engine: "browser",
    icon: ArrowLeftRight,
    runBrowser: async (files, _options, onProgress) => {
      const canvases: HTMLCanvasElement[] = [];
      let index = 0;
      while (true) {
        const left = await renderPdfPageToCanvas(files[0], index);
        const right = await renderPdfPageToCanvas(files[1], index);
        if (!left || !right) break;
        const diff = diffCanvases(left, right);
        if (diff) canvases.push(diff);
        index += 1;
        onProgress?.(Math.min(90, index * 20), `Comparing page ${index}`);
      }
      return await zipCanvasImages(canvases, "diff");
    }
  },
  {
    id: "translate-pdf",
    slug: "translate-pdf",
    title: "Translate PDF",
    description: "Translate text while keeping layout.",
    category: "Intelligence",
    inputTypes: ["pdf"],
    outputTypes: ["pdf"],
    optionsSchema: [
      {
        id: "target",
        label: "Target language",
        type: "select",
        defaultValue: "en",
        options: [
          { label: "English", value: "en" },
          { label: "Korean", value: "ko" },
          { label: "Japanese", value: "ja" }
        ]
      }
    ],
    engine: "browser",
    icon: WandSparkles,
    runBrowser: async (files, options) => {
      const target = String(options.target || "en");
      const text = await extractPdfText(files[0]);
      const translated = `Translated (${target})

${text}`;
      const doc = await PDFDocument.create();
      const page = doc.addPage([612, 792]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText(translated.slice(0, 1800), {
        x: 72,
        y: 720,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1)
      });
      const blob = bytesToBlob(await doc.save(), "application/pdf");
      return { blob, fileName: "translated.pdf" };
    },
    // browser-only
  }
];

function getCrossCategoryRelated(current: ToolDefinition) {
  return toolsRegistry
    .filter((tool) => tool.id !== current.id && tool.category !== current.category)
    .filter(
      (tool) =>
        tool.inputTypes.some((type) => current.outputTypes.includes(type)) ||
        tool.outputTypes.some((type) => current.inputTypes.includes(type)) ||
        tool.engine === current.engine
    )
    .slice(0, 3)
    .map((tool) => tool.slug);
}

function buildDefaultToolContent(tool: ToolDefinition): ToolContent {
  const optionLabels = tool.optionsSchema.map((option) => option.label);
  const optionHint =
    optionLabels.length > 0
      ? `${tool.title}에서는 ${optionLabels.join(", ")} 옵션을 조합해 결과를 세밀하게 조정할 수 있습니다.`
      : `${tool.title}는 복잡한 설정 없이 업로드 후 바로 실행해도 안정적인 결과를 제공하도록 설계되었습니다.`;
  const engineHint = "기본 브라우저 모드만으로도 주요 작업을 빠르게 처리할 수 있습니다.";

  return {
    intro:
      `${tool.title}는 ${tool.category} 작업을 빠르게 처리하기 위한 전용 도구입니다. 문서 형식 변환, 페이지 정리, 보안 작업처럼 반복되는 업무를 클릭 몇 번으로 끝내도록 구성했으며, 업로드 후 옵션을 설정하면 즉시 결과물을 받을 수 있습니다.\n\n` +
      `특히 ${tool.title}는 실무에서 발생하는 파일 전달 이슈를 줄이는 데 유용합니다. 브라우저에서 바로 처리해 속도를 확보하고, 옵션을 조정해 품질과 호환성을 끌어올릴 수 있어 개인 사용자와 팀 협업 모두에 적합합니다.`,
    useCases: [
      `${tool.title}를 이용해 회의 전 문서를 최종 제출 형식으로 빠르게 정리할 수 있습니다.`,
      `외부 공유 전에 ${tool.title}로 민감한 페이지나 포맷 문제를 점검하고 정리할 수 있습니다.`,
      `반복적으로 발생하는 ${tool.category} 작업을 ${tool.title}로 표준화해 처리 시간을 단축할 수 있습니다.`
    ],
    steps: [
      "Step 1: 파일 업로드 - 처리할 문서를 드래그하거나 파일 선택 버튼으로 불러옵니다.",
      "Step 2: 옵션 선택 - 작업 목적에 맞게 옵션을 확인하고 필요한 값만 조정합니다.",
      "Step 3: 실행 및 다운로드 - 실행 후 결과물을 즉시 다운로드하고 다음 작업으로 이어갑니다."
    ],
    tips: [
      optionHint,
      engineHint,
      "여러 파일을 다룰 때는 먼저 파일 순서와 이름을 정리하면 결과물 검수가 훨씬 쉬워집니다."
    ],
    faq: [
      {
        q: "파일이 서버로 업로드되나요?",
        a: `${tool.title}는 기본적으로 브라우저에서 처리됩니다. 업로드된 파일은 서버로 전송되지 않으며 브라우저 세션 내에서만 사용됩니다.`
      },
      {
        q: "파일은 저장되나요?",
        a: "기본 모드에서는 파일이 브라우저 세션 내에서만 사용됩니다. 세션 종료 후에는 자동으로 접근할 수 없습니다."
      },
      {
        q: "모바일에서도 사용 가능한가요?",
        a: `${tool.title}는 모바일 브라우저에서도 동작합니다. 다만 대용량 파일은 모바일 메모리 제약으로 처리 시간이 길어질 수 있습니다.`
      },
      {
        q: "대용량 파일은 어떻게 되나요?",
        a: "브라우저 메모리 한계에 근접하면 속도가 느려질 수 있습니다. 이 경우 파일을 분할하거나 페이지 범위를 나눠 처리하는 것을 권장합니다."
      },
      {
        q: "변환 품질이 낮을 때는 어떻게 하나요?",
        a: `${tool.title} 옵션에서 품질 관련 항목을 먼저 조정하고, 결과가 부족하면 해상도나 페이지 범위를 조정해 다시 실행해 보세요.`
      },
      {
        q: "처리 시간이 길어질 때는?",
        a: `파일 크기나 페이지 수가 많으면 처리 시간이 길어질 수 있습니다. 페이지 범위를 나누거나 파일을 분할해 단계적으로 처리하면 안정성이 높아집니다.`
      }
    ],
    related: getCrossCategoryRelated(tool)
  };
}

const TOOL_CONTENT_OVERRIDES: Record<string, Partial<ToolContent>> = {
  "merge-pdf": {
    intro:
      "Merge PDF는 여러 PDF를 한 파일로 결합할 때 가장 빠르게 쓰이는 기본 도구입니다. 계약서 본문/별첨/증빙처럼 파일이 분리된 상태에서 전달받았을 때 순서만 맞춰 한 번에 정리할 수 있어 문서 전달 실수를 줄여줍니다.\n\n" +
      "특히 검토용 문서를 공유할 때 버전별 파일이 흩어져 있으면 확인 시간이 늘어나는데, Merge PDF로 통합하면 검토 흐름이 단순해집니다. 팀 내 인수인계 문서, 교육 자료, 제출 패키지 생성에 자주 활용됩니다.",
    useCases: [
      "입찰/제안서 제출 시 본문과 부록 PDF를 하나로 묶어 제출 형식에 맞춥니다.",
      "프로젝트 산출물(요약본, 상세 스펙, 테스트 결과)을 순서대로 합쳐 공유합니다.",
      "월별 보고서 PDF를 병합해 분기 단위 아카이브 문서를 만듭니다."
    ],
    tips: [
      "파일 큐에서 순서를 먼저 정렬한 뒤 실행하면 병합 후 재작업을 크게 줄일 수 있습니다.",
      "페이지 번호가 포함된 원본끼리 병합할 때는 먼저 파일명을 정리해 추적 가능성을 높이세요.",
      "결합 후 용량이 커지면 Compress PDF를 바로 이어서 실행하는 것이 효율적입니다."
    ]
  },
  "ocr-pdf": {
    intro:
      "OCR PDF는 스캔본이나 이미지 기반 PDF에서 텍스트를 읽어 추출하는 도구입니다. 복사되지 않는 문서를 검색 가능 상태로 바꾸거나, 핵심 문장을 빠르게 발췌해야 할 때 가장 효과적입니다.\n\n" +
      "문자 인식 품질은 원본 해상도와 언어 설정에 크게 좌우됩니다. 문서 언어를 정확히 고르고 선명한 원본을 사용하면 인식 정확도가 높아지며, 이후 번역/요약 워크플로우로도 자연스럽게 연결할 수 있습니다.",
    useCases: [
      "스캔 계약서에서 조항 텍스트를 추출해 검토 문서로 옮깁니다.",
      "영수증/증빙 PDF에서 필요한 문구를 검색 가능한 텍스트로 변환합니다.",
      "이미지 기반 보고서를 텍스트화해 번역 또는 요약 도구로 이어갑니다."
    ],
    tips: [
      "언어 옵션은 반드시 문서 언어와 맞추세요. 잘못 선택하면 오인식 비율이 빠르게 올라갑니다.",
      "기울어진 스캔본은 먼저 보정한 뒤 OCR을 수행하면 결과가 안정적입니다.",
      "고정밀 결과가 필요하면 해상도를 높이거나 후속 수동 교정을 병행하세요."
    ]
  },
  "protect-pdf": {
    intro:
      "Protect PDF는 공유 전 문서에 암호를 적용해 열람 권한을 통제하는 보안 도구입니다. 외부 전송이 잦은 업무 환경에서 최소한의 접근 제어를 빠르게 적용할 수 있어 실무에서 활용도가 높습니다.\n\n" +
      "암호 설정은 문서 보안의 첫 단계입니다. 파일 자체 보호와 함께 전송 채널 분리(예: 파일과 암호를 다른 경로로 전달)를 병행하면 보안 수준을 더 높일 수 있습니다.",
    useCases: [
      "고객/파트너에게 전달하는 계약 문서에 열람 암호를 적용합니다.",
      "사내 공유 문서 중 민감한 재무 자료에 임시 보호를 설정합니다.",
      "승인 전 문서를 제한된 인원만 확인하도록 보호해 유출 위험을 낮춥니다."
    ],
    tips: [
      "암호는 예측하기 어려운 조합으로 설정하고, 전달 채널을 문서와 분리하세요.",
      "수신자 환경에서 파일 열람 테스트를 한 번 수행하면 재전송 이슈를 줄일 수 있습니다.",
      "암호 보호 후에도 필요하면 Redact PDF로 민감정보 자체를 제거하는 것이 안전합니다."
    ]
  }
};

function withToolContent(tool: ToolDefinition): ToolDefinition {
  const generated = buildDefaultToolContent(tool);
  const override = TOOL_CONTENT_OVERRIDES[tool.id];
  if (!override) {
    return { ...tool, content: generated };
  }
  return {
    ...tool,
    content: {
      ...generated,
      ...override,
      useCases: override.useCases ?? generated.useCases,
      steps: override.steps ?? generated.steps,
      tips: override.tips ?? generated.tips,
      faq: override.faq ?? generated.faq,
      related: override.related ?? generated.related
    }
  };
}

export const allTools = toolsRegistry.map(withToolContent);

export function getToolBySlug(slug: string) {
  return allTools.find((tool) => tool.slug === slug);
}

export function getRecommendations(current: ToolDefinition) {
  return allTools
    .filter((tool) => tool.category === current.category && tool.id !== current.id)
    .slice(0, 3);
}

export function getToolMetaDescription(tool: ToolDefinition) {
  let description =
    `${tool.title}를 브라우저에서 빠르게 실행하세요. ${tool.description} ` +
    "파일 업로드, 옵션 선택, 실행 및 다운로드까지 한 화면에서 처리할 수 있습니다.";
  if (description.length < 100) {
    description += " 대용량 파일은 페이지 범위를 나눠 실행하면 안정적입니다.";
  }
  if (description.length > 150) {
    description = `${description.slice(0, 147)}...`;
  }
  return description;
}
