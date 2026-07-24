import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const buildDirectory = resolve(process.cwd(), process.argv[2] ?? "dist");
await rm(resolve(buildDirectory, "server", ".dev.vars"), {
  force: true,
});
