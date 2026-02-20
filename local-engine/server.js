import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import rateLimit from "express-rate-limit";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const app = express();

const PORT = 34781;
const HOST = "127.0.0.1";
const MAX_FILES = Number(process.env.TOOLBOX_MAX_FILES || 200);
const MAX_FILE_BYTES = Number(process.env.TOOLBOX_MAX_FILE_BYTES || 1024 * 1024 * 1024);
const REQUEST_TIMEOUT_MS = Number(process.env.TOOLBOX_TIMEOUT_MS || 120_000);
const PAIRING_KEY_PATH = path.join(os.homedir(), ".toolbox-local-engine", "pairing.key");
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
    fieldSize: 32 * 1024,
    fields: 20
  }
});

let pairingKey = "";

async function ensurePairingKey() {
  if (process.env.TOOLBOX_PAIRING_KEY) {
    pairingKey = process.env.TOOLBOX_PAIRING_KEY.trim();
    return pairingKey;
  }
  try {
    const existing = (await fs.readFile(PAIRING_KEY_PATH, "utf8")).trim();
    if (existing) {
      pairingKey = existing;
      return pairingKey;
    }
  } catch {
    // Create a new key below when no file exists.
  }
  pairingKey = crypto.randomBytes(32).toString("hex");
  await fs.mkdir(path.dirname(PAIRING_KEY_PATH), { recursive: true });
  await fs.writeFile(PAIRING_KEY_PATH, `${pairingKey}\n`, { mode: 0o600 });
  return pairingKey;
}

function safeEqual(left, right) {
  const a = Buffer.from(left || "", "utf8");
  const b = Buffer.from(right || "", "utf8");
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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
  if (result.error?.name === "ETIMEDOUT") {
    throw new Error(`${command} timeout`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr || "Unknown command failure";
    throw new Error(`${command} failed: ${stderr}`);
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
  const hostname = parsed.hostname.toLowerCase();
  const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  const isPrivate172 = (() => {
    if (!ipv4) return false;
    const first = Number(ipv4[1]);
    const second = Number(ipv4[2]);
    return first === 172 && second >= 16 && second <= 31;
  })();

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    isPrivate172
  ) {
    throw new Error("Local/private network URL is blocked.");
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
      mimetype: file.mimetype
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
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === ".pptx") {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (ext === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "application/octet-stream";
}

async function sendOutputFile(res, filePath) {
  const buffer = await fs.readFile(filePath);
  res.setHeader("Content-Type", guessMimeByExt(filePath));
  res.setHeader("Content-Disposition", `attachment; filename=${path.basename(filePath)}`);
  return res.send(buffer);
}

function convertWithSoffice(inputPath, outDir, targetExt) {
  runCommand("soffice", [
    "--headless",
    "--convert-to",
    targetExt,
    "--outdir",
    outDir,
    inputPath
  ]);
  const base = path.basename(inputPath, path.extname(inputPath));
  return path.join(outDir, `${base}.${targetExt}`);
}

function requirePairingKey(req, res, next) {
  const key = String(req.headers["x-toolbox-pairing-key"] || "");
  if (!safeEqual(key, pairingKey)) {
    return res.status(401).json({ error: "Invalid pairing key." });
  }
  return next();
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Toolbox-Pairing-Key"],
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
  res.json({ ok: true });
});

app.post("/api/convert", requirePairingKey, upload.array("files"), async (req, res) => {
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

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-"));
  const inDir = path.join(tempRoot, "in");
  const outDir = path.join(tempRoot, "out");
  await fs.mkdir(inDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  try {
    ensureNeeds(toolId);
    const uploaded = await writeUploadedFiles(files, inDir);
    const firstInput = uploaded[0]?.path;
    if (!firstInput) {
      return res.status(400).send("No input file.");
    }

    let outputPath = "";

    switch (toolId) {
      case "word-to-pdf":
      case "powerpoint-to-pdf":
      case "excel-to-pdf":
        outputPath = convertWithSoffice(firstInput, outDir, "pdf");
        break;
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
        runCommand("gs", [
          "-sDEVICE=pdfwrite",
          "-dCompatibilityLevel=1.4",
          "-dPDFSETTINGS=/ebook",
          "-dNOPAUSE",
          "-dQUIET",
          "-dBATCH",
          `-sOutputFile=${outputPath}`,
          firstInput
        ]);
        break;
      case "repair-pdf":
        outputPath = path.join(outDir, "repaired.pdf");
        runCommand("qpdf", ["--linearize", firstInput, outputPath]);
        break;
      case "unlock-pdf": {
        outputPath = path.join(outDir, "unlocked.pdf");
        const password = String(options.password || "");
        runCommand("qpdf", [`--password=${password}`, "--decrypt", firstInput, outputPath]);
        break;
      }
      case "protect-pdf": {
        outputPath = path.join(outDir, "protected.pdf");
        const password = String(options.password || "");
        if (!password) {
          return res.status(400).send("Missing password option for protect-pdf.");
        }
        runCommand("qpdf", ["--encrypt", password, password, "256", "--", firstInput, outputPath]);
        break;
      }
      case "pdf-to-pdfa":
        outputPath = path.join(outDir, "archive-pdfa.pdf");
        runCommand("gs", [
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
        break;
      case "html-to-pdf": {
        outputPath = path.join(outDir, "page.pdf");
        const target = normalizeUrl(options.url);
        if (!target) {
          return res.status(400).send("Missing URL option for html-to-pdf.");
        }
        runCommand("chromium", [
          "--headless",
          "--disable-gpu",
          "--disable-extensions",
          "--no-first-run",
          "--no-default-browser-check",
          `--print-to-pdf=${outputPath}`,
          target
        ]);
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
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

await ensurePairingKey();
app.listen(PORT, HOST, () => {
  console.log(`Local engine listening at http://${HOST}:${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
  console.log(`Pairing key file: ${PAIRING_KEY_PATH}`);
});
