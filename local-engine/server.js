import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import rateLimit from "express-rate-limit";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { spawnSync } from "node:child_process";

const app = express();

const PORT = 34781;
const HOST = "127.0.0.1";
const MAX_FILES = Number(process.env.TOOLBOX_MAX_FILES || 20);
const MAX_FILE_BYTES = Number(process.env.TOOLBOX_MAX_FILE_BYTES || 1024 * 1024 * 1024);
const PPTX_MAX_BYTES = 200 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = Number(process.env.TOOLBOX_TIMEOUT_MS || 120_000);
const MAX_CONCURRENT = Number(process.env.TOOLBOX_MAX_CONCURRENT || 2);
const TOOL_IDS = new Set([
  "word-to-pdf",
  "powerpoint-to-pdf",
  "excel-to-pdf",
  "pdf-to-word",
  "pdf-to-powerpoint",
  "pdf-to-excel",
  "pdf-to-pdfa",
  "compress-pdf",
  "repair-pdf",
  "unlock-pdf",
  "protect-pdf",
  "html-to-pdf"
]);

const allowedOrigins = (process.env.TOOLBOX_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_BYTES,
    fieldSize: 64 * 1024,
    fields: 30
  }
});

let activeJobs = 0;
const queue = [];

function acquireSlot() {
  if (activeJobs < MAX_CONCURRENT) {
    activeJobs += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
}

function releaseSlot() {
  const next = queue.shift();
  if (next) {
    next();
    return;
  }
  activeJobs = Math.max(0, activeJobs - 1);
}

function hasBinary(bin) {
  const result = spawnSync("bash", ["-lc", `command -v ${bin}`], { stdio: "ignore" });
  return result.status === 0;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: REQUEST_TIMEOUT_MS,
    ...options
  });
  return result;
}

function ensureCommandSuccess(result, command) {
  if (result.error?.name === "ETIMEDOUT") {
    throw new Error("timeout");
  }
  if (result.status !== 0) {
    const stderr = String(result.stderr || "").toLowerCase();
    const stdout = String(result.stdout || "").toLowerCase();
    const logs = `${stderr}\n${stdout}`;
    if (logs.includes("password")) {
      throw new Error("암호화/보호된 파일입니다.");
    }
    if (logs.includes("font")) {
      throw new Error("폰트가 없어 대체 폰트로 변환되었습니다.");
    }
    if (logs.includes("corrupt") || logs.includes("damaged")) {
      throw new Error("손상된 파일이거나 지원되지 않는 형식입니다.");
    }
    throw new Error(`${command} failed`);
  }
}

function sanitizeFileName(name) {
  return String(name || "input.bin")
    .replace(/[\\/]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

function normalizeUrl(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Invalid URL option.");
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed.");
  }
  return parsed.toString();
}

async function writeUploadedFiles(files, dir) {
  const out = [];
  for (const file of files) {
    const safeName = sanitizeFileName(file.originalname || "input.bin");
    const fullPath = path.join(dir, safeName);
    await fs.writeFile(fullPath, file.buffer);
    out.push({
      path: fullPath,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
  }
  return out;
}

function ensureNeeds(toolId) {
  const needs = {
    "word-to-pdf": ["soffice"],
    "powerpoint-to-pdf": ["soffice"],
    "excel-to-pdf": ["soffice"],
    "pdf-to-word": ["soffice"],
    "pdf-to-powerpoint": ["soffice"],
    "pdf-to-excel": ["soffice"],
    "pdf-to-pdfa": ["gs"],
    "compress-pdf": ["gs"],
    "repair-pdf": ["qpdf"],
    "unlock-pdf": ["qpdf"],
    "protect-pdf": ["qpdf"],
    "html-to-pdf": ["chromium"]
  };

  const required = needs[toolId] || [];
  for (const bin of required) {
    if (!hasBinary(bin)) {
      throw new Error(`Missing dependency: ${bin}. Install it and retry (tool: ${toolId}).`);
    }
  }
}

function guessMimeByExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

async function sendOutputFile(res, filePath) {
  const buffer = await fs.readFile(filePath);
  res.setHeader("Content-Type", guessMimeByExt(filePath));
  res.setHeader("Content-Disposition", `attachment; filename=${path.basename(filePath)}`);
  return res.send(buffer);
}

function convertWithSoffice(inputPath, outDir, targetExt) {
  const result = runCommand("soffice", [
    "--headless",
    "--nologo",
    "--nofirststartwizard",
    "--convert-to",
    targetExt,
    "--outdir",
    outDir,
    inputPath
  ]);
  ensureCommandSuccess(result, "soffice");
  const base = path.basename(inputPath, path.extname(inputPath));
  return path.join(outDir, `${base}.${targetExt}`);
}

function compressPdfGhostscript(inputPath, outPath, quality = "balanced") {
  const profileMap = {
    high: "/prepress",
    balanced: "/ebook",
    small: "/screen"
  };
  const pdfSettings = profileMap[quality] || "/ebook";
  const result = runCommand("gs", [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    `-dPDFSETTINGS=${pdfSettings}`,
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    `-sOutputFile=${outPath}`,
    inputPath
  ]);
  ensureCommandSuccess(result, "gs");
}

async function extractPptxSlideMeta(pptxPath) {
  const buffer = await fs.readFile(pptxPath);
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);
  const slideCount = names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length;
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("string");
  let widthPt = 960;
  let heightPt = 540;
  if (presentationXml) {
    const sizeMatch = presentationXml.match(/(?:p:sldSz|sldSz)[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    if (sizeMatch) {
      const cx = Number(sizeMatch[1]);
      const cy = Number(sizeMatch[2]);
      if (cx > 0 && cy > 0) {
        widthPt = cx / 12700;
        heightPt = cy / 12700;
      }
    }
  }
  return { slideCount, widthPt, heightPt };
}

async function validateConvertedPdf(pptxPath, pdfPath) {
  const { slideCount, widthPt, heightPt } = await extractPptxSlideMeta(pptxPath);
  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pdfPages = pdfDoc.getPageCount();
  if (slideCount > 0 && pdfPages !== slideCount) {
    return {
      ok: false,
      message: `페이지 수 불일치(슬라이드 ${slideCount}, PDF ${pdfPages})`
    };
  }
  const firstPage = pdfDoc.getPage(0);
  const size = firstPage.getSize();
  const sourceRatio = widthPt / heightPt;
  const resultRatio = size.width / size.height;
  const ratioDiff = Math.abs(sourceRatio - resultRatio);
  if (ratioDiff > 0.08) {
    return { ok: false, message: "페이지 크기 비율 검증 실패(슬라이드 비율과 차이 큼)" };
  }
  return { ok: true, message: "검증 통과" };
}

async function convertPptxToPdfLibreOffice(inputPath, outDir, options) {
  const outputPath = convertWithSoffice(inputPath, outDir, "pdf");
  const quality = String(options.quality || "high");
  const compressMode = String(options.compressMode || "none");
  if (quality === "small" || compressMode !== "none") {
    const optimized = path.join(outDir, "powerpoint-optimized.pdf");
    const gsQuality = quality === "small" ? "small" : quality === "high" ? "high" : "balanced";
    compressPdfGhostscript(outputPath, optimized, gsQuality);
    return optimized;
  }
  return outputPath;
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 86400
  })
);
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  req.setTimeout(REQUEST_TIMEOUT_MS);
  res.setTimeout(REQUEST_TIMEOUT_MS);
  next();
});
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, activeJobs, queuedJobs: queue.length });
});

app.post("/api/convert", upload.array("files"), async (req, res) => {
  await acquireSlot();
  let tempRoot = "";
  try {
    const toolId = String(req.body.toolId || "");
    if (!TOOL_IDS.has(toolId)) {
      return res.status(400).send("Unsupported toolId.");
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).send("No files provided.");
    }

    const options = (() => {
      try {
        const raw = JSON.parse(String(req.body.options || "{}"));
        return typeof raw === "object" && raw ? raw : {};
      } catch {
        return {};
      }
    })();

    const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (toolId === "powerpoint-to-pdf" && totalBytes > PPTX_MAX_BYTES) {
      return res.status(413).send("PPTX size limit exceeded (max 200MB).");
    }

    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-"));
    const inDir = path.join(tempRoot, "in");
    const outDir = path.join(tempRoot, "out");
    await fs.mkdir(inDir, { recursive: true });
    await fs.mkdir(outDir, { recursive: true });

    ensureNeeds(toolId);
    const uploaded = await writeUploadedFiles(files, inDir);
    const firstInput = uploaded[0]?.path;
    if (!firstInput) {
      return res.status(400).send("No input file.");
    }

    let outputPath = "";

    switch (toolId) {
      case "word-to-pdf":
      case "excel-to-pdf":
        outputPath = convertWithSoffice(firstInput, outDir, "pdf");
        break;
      case "powerpoint-to-pdf": {
        outputPath = await convertPptxToPdfLibreOffice(firstInput, outDir, options);
        const validation = await validateConvertedPdf(firstInput, outputPath);
        if (!validation.ok) {
          return res.status(422).send(
            `${validation.message}. 브라우저 모드로 다시 시도하거나 High/Balanced 옵션을 바꿔보세요.`
          );
        }
        break;
      }
      case "pdf-to-word":
        outputPath = convertWithSoffice(firstInput, outDir, "docx");
        break;
      case "pdf-to-powerpoint":
        outputPath = convertWithSoffice(firstInput, outDir, "pptx");
        break;
      case "pdf-to-excel":
        outputPath = convertWithSoffice(firstInput, outDir, "xlsx");
        break;
      case "compress-pdf":
        outputPath = path.join(outDir, "compressed.pdf");
        compressPdfGhostscript(firstInput, outputPath, "balanced");
        break;
      case "repair-pdf": {
        outputPath = path.join(outDir, "repaired.pdf");
        const result = runCommand("qpdf", ["--linearize", firstInput, outputPath]);
        ensureCommandSuccess(result, "qpdf");
        break;
      }
      case "unlock-pdf": {
        outputPath = path.join(outDir, "unlocked.pdf");
        const password = String(options.password || "");
        const result = runCommand("qpdf", [`--password=${password}`, "--decrypt", firstInput, outputPath]);
        ensureCommandSuccess(result, "qpdf");
        break;
      }
      case "protect-pdf": {
        outputPath = path.join(outDir, "protected.pdf");
        const password = String(options.password || "");
        if (!password) {
          return res.status(400).send("Missing password option for protect-pdf.");
        }
        const result = runCommand("qpdf", ["--encrypt", password, password, "256", "--", firstInput, outputPath]);
        ensureCommandSuccess(result, "qpdf");
        break;
      }
      case "pdf-to-pdfa": {
        outputPath = path.join(outDir, "archive-pdfa.pdf");
        const result = runCommand("gs", [
          "-dPDFA=2",
          "-dBATCH",
          "-dNOPAUSE",
          "-dNOOUTERSAVE",
          "-sProcessColorModel=DeviceRGB",
          "-sDEVICE=pdfwrite",
          "-sPDFACompatibilityPolicy=1",
          `-sOutputFile=${outputPath}`,
          firstInput
        ]);
        ensureCommandSuccess(result, "gs");
        break;
      }
      case "html-to-pdf": {
        outputPath = path.join(outDir, "page.pdf");
        const target = normalizeUrl(options.url);
        if (!target) {
          return res.status(400).send("Missing URL option for html-to-pdf.");
        }
        const result = runCommand("chromium", [
          "--headless",
          "--disable-gpu",
          "--disable-extensions",
          "--no-first-run",
          "--no-default-browser-check",
          `--print-to-pdf=${outputPath}`,
          target
        ]);
        ensureCommandSuccess(result, "chromium");
        break;
      }
      default:
        return res.status(501).send("Not implemented.");
    }

    await fs.access(outputPath);
    return await sendOutputFile(res, outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local engine failed.";
    return res.status(500).send(message);
  } finally {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
    releaseSlot();
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Local engine listening at http://${HOST}:${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});
