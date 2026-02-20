import fs from "node:fs/promises";
import path from "node:path";

const outDir = path.join(process.cwd(), "out");
const skip = new Set(["index", "404", "_not-found"]);

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
    patched += 1;
  }

  console.log(`patched route index files: ${patched}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
