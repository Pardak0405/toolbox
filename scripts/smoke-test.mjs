import fs from "node:fs";
import path from "node:path";

const examplesDir = path.join(process.cwd(), "examples");
if (!fs.existsSync(examplesDir)) {
  console.log("No examples directory found. Add sample files to /examples.");
  process.exit(0);
}

const files = fs.readdirSync(examplesDir);
console.log("Found sample files:");
files.forEach((file) => console.log("-", file));
console.log("Run the app and test each tool manually with these files.");
