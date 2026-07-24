import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const blocked = [
  {
    label: "private key material",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    label: "Supabase service credential",
    pattern:
      /SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY)\s*=\s*(?:eyJ[A-Za-z0-9._-]+|sb_secret_[A-Za-z0-9._-]+)/,
  },
  {
    label: "Supabase management token",
    pattern: /SUPABASE_ACCESS_TOKEN\s*=\s*sbp_[A-Za-z0-9._-]+/,
  },
  {
    label: "PostgreSQL password in URL",
    pattern: /postgresql:\/\/postgres:[^@\s]+@/,
  },
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
  for (const blockedValue of blocked) {
    if (blockedValue.pattern.test(content)) {
      findings.push(`${file}: blocked ${blockedValue.label}`);
    }
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log(`Secret scan passed across ${scanned} source and built files.`);
