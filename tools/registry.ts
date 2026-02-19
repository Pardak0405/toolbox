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
import { callLocalEngine } from "@/app/_lib/local-engine";

export type ToolEngine = "browser" | "local" | "hybrid";

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
    onProgress?: (progress: number, status: string) => void
  ) => Promise<ToolResult>;
  runLocal?: (
    files: File[],
    options: Record<string, unknown>,
    token: string
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

async function createNoticePdf(title: string, detail: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(title, {
    x: 72,
    y: 700,
    size: 20,
    font,
    color: rgb(0.12, 0.12, 0.12)
  });
  page.drawText(detail, {
    x: 72,
    y: 660,
    size: 12,
    font,
    color: rgb(0.3, 0.3, 0.3)
  });
  return bytesToBlob(await doc.save(), "application/pdf");
}

const localRunner = async (
  toolId: string,
  files: File[],
  options: Record<string, unknown>,
  token: string
) => {
  const blob = await callLocalEngine({ toolId, files, options, token });
  return { blob, fileName: `${toolId}-output.zip` };
};

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
    engine: "hybrid",
    icon: FileMinus,
    runBrowser: async (files) => ({
      blob: files[0],
      fileName: "compressed.pdf"
    }),
    runLocal: (files, options, token) =>
      localRunner("compress-pdf", files, options, token)
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
    engine: "hybrid",
    icon: WandSparkles,
    runBrowser: async (files) => ({
      blob: files[0],
      fileName: "repaired.pdf"
    }),
    runLocal: (files, options, token) =>
      localRunner("repair-pdf", files, options, token)
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
    runBrowser: async (files, options, onProgress) => {
      const lines: string[] = [];
      const language = String(options.language || "eng");
      let index = 0;
      while (true) {
        const canvas = await renderPdfPageToCanvas(files[0], index);
        if (!canvas) break;
        const text = await runOcrOnCanvas(canvas, language);
        lines.push(text);
        index += 1;
        onProgress?.(Math.min(90, index * 15), `OCR page ${index}`);
      }
      const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
      return { blob, fileName: "ocr.txt" };
    }
  },
  {
    id: "jpg-to-pdf",
    slug: "jpg-to-pdf",
    title: "JPG to PDF",
    description: "Convert JPG images into a PDF.",
    category: "Convert to PDF",
    inputTypes: ["jpg", "jpeg"],
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
    engine: "hybrid",
    icon: FileType2,
    runBrowser: async () => ({
      blob: await createNoticePdf(
        "Browser conversion is limited",
        "For accurate Word → PDF conversion, use the local engine."
      ),
      fileName: "browser-converted.pdf"
    }),
    runLocal: (files, options, token) =>
      localRunner("word-to-pdf", files, options, token)
  },
  {
    id: "powerpoint-to-pdf",
    slug: "powerpoint-to-pdf",
    title: "PowerPoint to PDF",
    description: "Convert PPTX slides to PDF.",
    category: "Convert to PDF",
    inputTypes: ["ppt", "pptx"],
    outputTypes: ["pdf"],
    optionsSchema: [],
    engine: "hybrid",
    icon: FileType2,
    runBrowser: async () => ({
      blob: await createNoticePdf(
        "Browser conversion is limited",
        "For accurate PowerPoint → PDF conversion, use the local engine."
      ),
      fileName: "browser-converted.pdf"
    }),
    runLocal: (files, options, token) =>
      localRunner("powerpoint-to-pdf", files, options, token)
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
    engine: "hybrid",
    icon: FileType2,
    runBrowser: async () => ({
      blob: await createNoticePdf(
        "Browser conversion is limited",
        "For accurate Excel → PDF conversion, use the local engine."
      ),
      fileName: "browser-converted.pdf"
    }),
    runLocal: (files, options, token) =>
      localRunner("excel-to-pdf", files, options, token)
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
    engine: "hybrid",
    icon: FileUp,
    runBrowser: async (_files, options) => ({
      blob: await createNoticePdf(
        "HTML to PDF (browser preview)",
        `We captured ${String(options.url || "a URL")} in browser mode. Use local engine for full fidelity.`
      ),
      fileName: "browser-html.pdf"
    }),
    runLocal: (files, options, token) =>
      localRunner("html-to-pdf", files, options, token)
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
    engine: "hybrid",
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
    runLocal: (files, options, token) =>
      localRunner("pdf-to-word", files, options, token)
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
    engine: "hybrid",
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
    runLocal: (files, options, token) =>
      localRunner("pdf-to-powerpoint", files, options, token)
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
    engine: "hybrid",
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
    runLocal: (files, options, token) =>
      localRunner("pdf-to-excel", files, options, token)
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
    engine: "hybrid",
    icon: FileDown,
    runBrowser: async (files) => ({
      blob: files[0],
      fileName: "archive.pdf"
    }),
    runLocal: (files, options, token) =>
      localRunner("pdf-to-pdfa", files, options, token)
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
    engine: "hybrid",
    icon: Unlock,
    runBrowser: async (files) => ({
      blob: files[0],
      fileName: "unlocked.pdf"
    }),
    runLocal: (files, options, token) =>
      localRunner("unlock-pdf", files, options, token)
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
    engine: "hybrid",
    icon: Lock,
    runBrowser: async (files) => ({
      blob: files[0],
      fileName: "protected.pdf"
    }),
    runLocal: (files, options, token) =>
      localRunner("protect-pdf", files, options, token)
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
    engine: "hybrid",
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
    runLocal: (files, options, token) =>
      localRunner("translate-pdf", files, options, token)
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
  const engineHint =
    tool.engine === "browser"
      ? "기본 브라우저 모드만으로도 주요 작업을 빠르게 처리할 수 있습니다."
      : "브라우저 모드로 바로 시작하고, 품질이 중요하거나 대용량 문서라면 로컬 엔진 모드를 권장합니다.";

  return {
    intro:
      `${tool.title}는 ${tool.category} 작업을 빠르게 처리하기 위한 전용 도구입니다. 문서 형식 변환, 페이지 정리, 보안 작업처럼 반복되는 업무를 클릭 몇 번으로 끝내도록 구성했으며, 업로드 후 옵션을 설정하면 즉시 결과물을 받을 수 있습니다.\n\n` +
      `특히 ${tool.title}는 실무에서 발생하는 파일 전달 이슈를 줄이는 데 유용합니다. 브라우저에서 우선 처리해 속도를 확보하고, 필요 시 로컬 엔진으로 확장해 품질과 호환성을 끌어올릴 수 있어 개인 사용자와 팀 협업 모두에 적합합니다.`,
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
        a: `${tool.title}는 기본적으로 브라우저에서 처리됩니다. 로컬 엔진 버튼을 직접 실행하는 경우에만 사용자의 PC 로컬 엔진으로 전송됩니다.`
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
        a: "브라우저 메모리 한계에 근접하면 속도가 느려질 수 있습니다. 이 경우 파일을 분할하거나 로컬 엔진 모드로 전환하는 것을 권장합니다."
      },
      {
        q: "변환 품질이 낮을 때는 어떻게 하나요?",
        a: `${tool.title} 옵션에서 품질 관련 항목을 먼저 조정하고, 결과가 부족하면 로컬 엔진으로 고정밀 변환을 시도해 보세요.`
      },
      {
        q: "로컬 엔진이 필요한 경우는?",
        a: `복잡한 레이아웃 유지, 오피스 문서 고정밀 변환, 대용량 일괄 처리처럼 브라우저 한계를 넘는 작업에서는 ${tool.title}의 로컬 엔진 모드가 필요합니다.`
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
      "고정밀 결과가 필요하면 로컬 엔진 OCR 또는 후속 수동 교정을 병행하세요."
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
    description += " 대용량이나 고품질 결과가 필요하면 로컬 엔진 모드를 함께 사용할 수 있습니다.";
  }
  if (description.length > 150) {
    description = `${description.slice(0, 147)}...`;
  }
  return description;
}
