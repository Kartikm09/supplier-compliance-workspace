// Local React rendering comparison; not part of the deployed application.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createServer: createViteServer } = await import(require.resolve("vite"));

const root = fileURLToPath(new URL("../apps/web/", import.meta.url));
const vite = await createViteServer({ root, server: { middlewareMode: true }, appType: "custom" });
const { render } = await vite.ssrLoadModule("/src/reviewer/render-content.tsx");
const generatedPath = new URL("../apps/web/public/generated-review.html", import.meta.url);
if (process.argv.includes("--generate")) {
  await writeFile(generatedPath, render());
  await vite.close();
  process.exit(0);
}
const generated = await readFile(generatedPath, "utf8");
let serverRenders = 0;
const server = createServer(async (request, response) => {
  const mode = request.url?.match(/^\/render\/(ssr|csr|ssg)$/)?.[1];
  if (!mode) return vite.middlewares(request, response, () => { response.statusCode = 404; response.end("Not found"); });
  const content = mode === "csr" ? "" : mode === "ssg" ? generated : render();
  if (mode === "ssr") serverRenders++;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("X-Render-Mode", mode);
  response.setHeader("X-Server-Renders", String(serverRenders));
  const html = `<!doctype html><html lang="en" data-mode="${mode}"><head><meta charset="utf-8"><title>Rendering comparison</title></head><body><div id="root">${content}</div><script type="module" src="/src/reviewer/render-client.tsx"></script></body></html>`;
  response.end(await vite.transformIndexHtml(request.url, html));
});
server.listen(5188, "127.0.0.1");
