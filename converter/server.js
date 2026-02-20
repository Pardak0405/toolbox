const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");
const { AwsClient } = require("aws4fetch");

const app = express();
app.use(express.json({ limit: "2mb" }));

function requireSecret(req, res, next) {
  const expected = process.env.TOOLBOX_SECRET;
  if (!expected) return res.status(500).json({ ok: false, error: "Server secret not set" });
  const got = req.header("X-Toolbox-Secret");
  if (got !== expected) return res.status(403).json({ ok: false, error: "Forbidden" });
  next();
}

function tmpDir(jobId) {
  const d = path.join("/tmp", String(jobId || "job").replace(/[^a-zA-Z0-9_-]/g, "_"));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function r2Client() {
  return new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    region: "auto",
    service: "s3"
  });
}

function r2Endpoint() {
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

async function r2GetObject(bucket, key) {
  const url = `${r2Endpoint()}/${bucket}/${key}`;
  const aws = r2Client();
  const signed = await aws.sign(url, { method: "GET" });
  const resp = await fetch(signed.url, { method: "GET" });
  if (!resp.ok) throw new Error(`R2 GET failed: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function r2PutObject(bucket, key, buf, contentType) {
  const url = `${r2Endpoint()}/${bucket}/${key}`;
  const aws = r2Client();
  const signed = await aws.sign(url, {
    method: "PUT",
    headers: { "Content-Type": contentType }
  });
  const resp = await fetch(signed.url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buf
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`R2 PUT failed: ${resp.status} ${t}`);
  }
}

function convertPptxToPdf(inputPath, outDir) {
  return new Promise((resolve, reject) => {
    execFile(
      "soffice",
      [
        "--headless",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to",
        "pdf",
        "--outdir",
        outDir,
        inputPath
      ],
      { timeout: 120000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`soffice failed: ${stderr || err.message}`));
        resolve({ stdout, stderr });
      }
    );
  });
}

app.post("/convert/pptx-to-pdf", requireSecret, async (req, res) => {
  const bucket = process.env.R2_BUCKET_NAME;
  const { jobId, inputKey, outputKey } = req.body || {};

  if (!bucket) {
    return res.status(500).json({ ok: false, error: "R2_BUCKET_NAME not set" });
  }
  if (!jobId || !inputKey || !outputKey) {
    return res.status(400).json({ ok: false, error: "jobId, inputKey, outputKey required" });
  }

  const dir = tmpDir(jobId);
  const inPath = path.join(dir, "input.pptx");
  const outDir = path.join(dir, "out");

  try {
    fs.mkdirSync(outDir, { recursive: true });

    const pptx = await r2GetObject(bucket, inputKey);
    fs.writeFileSync(inPath, pptx);

    await convertPptxToPdf(inPath, outDir);

    const files = fs.readdirSync(outDir).filter((f) => f.toLowerCase().endsWith(".pdf"));
    if (!files.length) throw new Error("No PDF output generated");
    const pdfPath = path.join(outDir, files[0]);
    const pdfBuf = fs.readFileSync(pdfPath);

    await r2PutObject(bucket, outputKey, pdfBuf, "application/pdf");

    return res.json({ ok: true, outputKey });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("listening on", port));
