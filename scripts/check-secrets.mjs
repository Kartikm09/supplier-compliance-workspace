import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const blocked = [
  ["-----BEGIN", "PRIVATE KEY-----"].join(" "),
  ["SUPABASE_SERVICE_ROLE_KEY", "="].join(""),
  ["SUPABASE_SECRET_KEY", "=sb_secret_"].join(""),
  ["SUPABASE_ACCESS_TOKEN", "=sbp_"].join(""),
  ["postgresql", "://postgres:"].join(""),
];

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);

function builtAssets(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? builtAssets(path) : [path];
    });
  } catch {
    return [];
  }
}

const candidates = [
  ...new Set([...files, ...builtAssets("apps/web/dist")]),
];
const findings = [];
let scanned = 0;
for (const file of candidates) {
  if (statSync(file).size > 8 * 1024 * 1024) continue;
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  const content = bytes.toString("utf8");
  scanned += 1;
  for (const marker of blocked) {
    if (content.includes(marker)) {
      findings.push(`${file}: blocked marker ${marker}`);
    }
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log(`Secret scan passed across ${scanned} source and built files.`);
