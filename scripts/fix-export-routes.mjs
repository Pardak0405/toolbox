import fs from "node:fs/promises";
import path from "node:path";

const outDir = path.join(process.cwd(), "out");
const skip = new Set(["index", "404", "_not-found"]);
const isDev = process.env.NODE_ENV !== "production";

function buildCsp() {
  const adScript = [
    "https://pagead2.googlesyndication.com",
    "https://googleads.g.doubleclick.net",
    "https://tpc.googlesyndication.com"
  ];
  const adConnect = [
    "https://pagead2.googlesyndication.com",
    "https://googleads.g.doubleclick.net",
    "https://ep1.adtrafficquality.google"
  ];
  const scriptSrc = [
    "'self'",
    ...adScript,
    ...(isDev ? ["'unsafe-eval'", "'unsafe-inline'"] : [])
  ].join(" ");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${adScript.join(" ")}`,
    `connect-src 'self' http://127.0.0.1:34781 ${adConnect.join(" ")}`,
    "font-src 'self' data:",
    `frame-src 'self' ${adScript.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join("; ");
}

function buildHeadersFile() {
  const lines = [
    "/*",
    `  Content-Security-Policy: ${buildCsp()}`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
    "  X-Frame-Options: DENY",
    "  Cross-Origin-Opener-Policy: same-origin",
    "  Cross-Origin-Resource-Policy: same-site",
    "  Cross-Origin-Embedder-Policy: unsafe-none"
  ];

  if (!isDev) {
    lines.push("  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload");
  }
  return `${lines.join("\n")}\n`;
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  if (!(await exists(outDir))) {
    console.log("skip: out directory not found");
    return;
  }

  const entries = await fs.readdir(outDir, { withFileTypes: true });
  const htmlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => entry.name);

  let patched = 0;
  const redirects = [];
  for (const fileName of htmlFiles) {
    const base = fileName.slice(0, -5);
    if (skip.has(base)) continue;

    const source = path.join(outDir, fileName);
    const routeDir = path.join(outDir, base);
    const indexFile = path.join(routeDir, "index.html");

    if (!(await exists(routeDir))) {
      await fs.mkdir(routeDir, { recursive: true });
    }
    await fs.copyFile(source, indexFile);
    redirects.push(`/${base} /${base}/ 308`);
    patched += 1;
  }

  if (redirects.length > 0) {
    const redirectsPath = path.join(outDir, "_redirects");
    const content = `${redirects.join("\n")}\n`;
    await fs.writeFile(redirectsPath, content, "utf8");
    console.log(`generated redirects: ${redirects.length}`);
  }

  const headersPath = path.join(outDir, "_headers");
  await fs.writeFile(headersPath, buildHeadersFile(), "utf8");
  console.log("generated headers: 1");

  console.log(`patched route index files: ${patched}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
