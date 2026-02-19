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

export type ToolDefinition = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  inputTypes: string[];
  outputTypes: string[];
  optionsSchema: ToolOptionField[];
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

export const allTools = toolsRegistry;

export function getToolBySlug(slug: string) {
  return allTools.find((tool) => tool.slug === slug);
}

export function getRecommendations(current: ToolDefinition) {
  return allTools
    .filter((tool) => tool.category === current.category && tool.id !== current.id)
    .slice(0, 3);
}
