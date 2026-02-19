import express from "express";
import cors from "cors";
import multer from "multer";
import { execSync } from "node:child_process";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = 34781;
const HOST = "127.0.0.1";
const allowedOrigins = (process.env.DOCFORGE_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((value) => value.trim());
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

app.post("/api/convert", upload.array("files"), async (req, res) => {
  if (!sessionToken) {
    return res.status(400).send("Set DOCFORGE_SESSION_TOKEN before running.");
  }
  if (req.headers["x-session-token"] !== sessionToken) {
    return res.status(401).send("Invalid session token.");
  }

  const { toolId } = req.body;
  if (!toolId) {
    return res.status(400).send("Missing toolId.");
  }

  const needs = {
    "word-to-pdf": ["soffice"],
    "powerpoint-to-pdf": ["soffice"],
    "excel-to-pdf": ["soffice"],
    "pdf-to-pdfa": ["qpdf", "gs"],
    "compress-pdf": ["gs"],
    "repair-pdf": ["qpdf"],
    "unlock-pdf": ["qpdf"],
    "protect-pdf": ["qpdf"],
    "translate-pdf": ["tesseract"],
    "html-to-pdf": ["chromium"],
    "pdf-to-word": ["soffice"],
    "pdf-to-powerpoint": ["soffice"],
    "pdf-to-excel": ["soffice"]
  };

  const required = needs[toolId] || [];
  for (const bin of required) {
    try {
      execSync(`command -v ${bin}`, { stdio: "ignore" });
    } catch {
      return res
        .status(412)
        .send(
          `Missing dependency: ${bin}. Install it and retry (tool: ${toolId}).`
        );
    }
  }

  const files = req.files || [];
  if (!files.length) {
    return res.status(400).send("No files provided.");
  }

  // Placeholder: return the first file for now. Replace with real conversions.
  const first = files[0];
  res.setHeader("Content-Type", first.mimetype || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=local-${first.originalname}`
  );
  return res.send(first.buffer);
});

app.listen(PORT, HOST, () => {
  console.log(`Local engine listening at http://${HOST}:${PORT}`);
  console.log("Allowed origins:", allowedOrigins.join(", "));
});
