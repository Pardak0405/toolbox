import express from "express";
import cors from "cors";
import multer from "multer";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = 34781;
const HOST = "127.0.0.1";
const allowedOrigins = (process.env.DOCFORGE_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const sessionToken = process.env.DOCFORGE_SESSION_TOKEN || "";

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin not allowed"));
      }
    }
  })
);

function hasBinary(bin) {
  const result = spawnSync("bash", ["-lc", `command -v ${bin}`], {
    stdio: "ignore"
  });
  return result.status === 0;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options
  });
  if (result.status !== 0) {
    const stderr = result.stderr || "Unknown command failure";
    throw new Error(`${command} failed: ${stderr}`);
  }
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
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
      throw new Error(
        `Missing dependency: ${bin}. Install it and retry (tool: ${toolId}).`
      );
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
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${path.basename(filePath)}`
  );
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

app.post("/api/convert", upload.array("files"), async (req, res) => {
  if (!sessionToken) {
    return res.status(400).send("Set DOCFORGE_SESSION_TOKEN before running.");
  }
  if (req.headers["x-session-token"] !== sessionToken) {
    return res.status(401).send("Invalid session token.");
  }

  const toolId = String(req.body.toolId || "");
  if (!toolId) {
    return res.status(400).send("Missing toolId.");
  }

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return res.status(400).send("No files provided.");
  }

  const options = (() => {
    try {
      return JSON.parse(String(req.body.options || "{}"));
    } catch {
      return {};
    }
  })();

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "docforge-"));
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
      case "excel-to-pdf": {
        outputPath = convertWithSoffice(firstInput, outDir, "pdf");
        break;
      }
      case "pdf-to-word": {
        outputPath = convertWithSoffice(firstInput, outDir, "docx");
        break;
      }
      case "pdf-to-powerpoint": {
        outputPath = convertWithSoffice(firstInput, outDir, "pptx");
        break;
      }
      case "pdf-to-excel": {
        outputPath = convertWithSoffice(firstInput, outDir, "xlsx");
        break;
      }
      case "compress-pdf": {
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
      }
      case "repair-pdf": {
        outputPath = path.join(outDir, "repaired.pdf");
        runCommand("qpdf", ["--linearize", firstInput, outputPath]);
        break;
      }
      case "unlock-pdf": {
        outputPath = path.join(outDir, "unlocked.pdf");
        const password = String(options.password || "");
        runCommand("qpdf", [
          `--password=${password}`,
          "--decrypt",
          firstInput,
          outputPath
        ]);
        break;
      }
      case "protect-pdf": {
        outputPath = path.join(outDir, "protected.pdf");
        const password = String(options.password || "");
        if (!password) {
          return res.status(400).send("Missing password option for protect-pdf.");
        }
        runCommand("qpdf", [
          "--encrypt",
          password,
          password,
          "256",
          "--",
          firstInput,
          outputPath
        ]);
        break;
      }
      case "pdf-to-pdfa": {
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
      }
      case "html-to-pdf": {
        outputPath = path.join(outDir, "page.pdf");
        const url = String(options.url || "").trim();
        const target = url || `file://${firstInput}`;
        runCommand("chromium", [
          "--headless",
          "--disable-gpu",
          `--print-to-pdf=${outputPath}`,
          target
        ]);
        break;
      }
      default: {
        return res.status(501).send(
          `Local engine for '${toolId}' is not implemented yet. Use browser mode or install workflow-specific converter.`
        );
      }
    }

    await fs.access(outputPath);
    return await sendOutputFile(res, outputPath);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Local engine failed.";
    return res.status(500).send(message);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Local engine listening at http://${HOST}:${PORT}`);
  console.log("Allowed origins:", allowedOrigins.join(", "));
});
