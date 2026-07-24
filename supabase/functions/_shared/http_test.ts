import { AppError } from "./errors.ts";
import { handleRequest, readJson } from "./http.ts";
import { assertEquals, assertRejects } from "./test_support.ts";

Deno.test("HTTP wrapper handles preflight and method restrictions without credentials", async () => {
  const preflight = await handleRequest(
    new Request("http://local.test", {
      method: "OPTIONS",
      headers: { origin: "http://127.0.0.1:5173" },
    }),
    "test",
    () => Promise.resolve(new Response("unexpected")),
  );
  assertEquals(preflight.status, 204);
  assertEquals(
    preflight.headers.get("access-control-allow-origin"),
    "http://127.0.0.1:5173",
  );

  const rejected = await handleRequest(
    new Request("http://local.test", { method: "GET" }),
    "test",
    () => Promise.resolve(new Response("unexpected")),
  );
  assertEquals(rejected.status, 405);
});

Deno.test("JSON reader enforces media type, syntax, and maximum bytes", async () => {
  const mediaError = await assertRejects(
    () =>
      readJson(
        new Request("http://local.test", {
          method: "POST",
          body: "{}",
          headers: { "content-type": "text/plain" },
        }),
      ),
  ) as AppError;
  assertEquals(mediaError.status, 415);

  const syntaxError = await assertRejects(
    () =>
      readJson(
        new Request("http://local.test", {
          method: "POST",
          body: "{",
          headers: { "content-type": "application/json" },
        }),
      ),
  ) as AppError;
  assertEquals(syntaxError.code, "malformed_json");

  const sizeError = await assertRejects(
    () =>
      readJson(
        new Request("http://local.test", {
          method: "POST",
          body: JSON.stringify({ value: "x".repeat(100) }),
          headers: { "content-type": "application/json" },
        }),
        16,
      ),
  ) as AppError;
  assertEquals(sizeError.status, 413);
});
