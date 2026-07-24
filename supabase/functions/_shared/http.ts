import { AppError, publicError } from "./errors.ts";
import { structuredLog } from "./logging.ts";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

export interface RequestContext {
  correlationId: string;
}

function allowedOrigins(): string[] {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return configured.split(",").map((value) => value.trim()).filter(Boolean);
}

function requestOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (!origin) return allowedOrigins()[0] ?? "null";
  return allowedOrigins().includes(origin) ? origin : "null";
}

export function corsHeaders(request: Request): HeadersInit {
  return {
    "access-control-allow-origin": requestOrigin(request),
    "access-control-allow-headers":
      "authorization, apikey, content-type, x-client-info, x-correlation-id, x-internal-token",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}

export function correlationId(request: Request): string {
  const supplied = request.headers.get("x-correlation-id");
  return supplied && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(supplied)
    ? supplied
    : crypto.randomUUID();
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status: number,
  requestCorrelationId: string,
  extraHeaders: HeadersInit = {},
): Response {
  const headers = new Headers(corsHeaders(request));
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-correlation-id", requestCorrelationId);
  new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

export function optionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

async function readLimitedBody(request: Request, maximumBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new AppError(413, "request_too_large", "The request body is too large.");
  }

  if (!request.body) throw new AppError(400, "missing_body", "A JSON request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new AppError(413, "request_too_large", "The request body is too large.");
    }
    chunks.push(value);
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function readJson(
  request: Request,
  maximumBytes = 32_768,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (contentType !== "application/json") {
    throw new AppError(415, "unsupported_media_type", "Content-Type must be application/json.");
  }
  const raw = new TextDecoder().decode(await readLimitedBody(request, maximumBytes));
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError(400, "malformed_json", "The request body must contain valid JSON.");
  }
}

export async function handleRequest(
  request: Request,
  event: string,
  operation: (context: RequestContext) => Promise<Response>,
): Promise<Response> {
  const requestCorrelationId = correlationId(request);
  if (request.method === "OPTIONS") return optionsResponse(request);
  if (request.method !== "POST") {
    return jsonResponse(
      request,
      {
        error: { code: "method_not_allowed", message: "Use POST." },
        correlation_id: requestCorrelationId,
      },
      405,
      requestCorrelationId,
      { allow: "POST, OPTIONS" },
    );
  }

  try {
    return await operation({ correlationId: requestCorrelationId });
  } catch (caught) {
    const error = publicError(caught);
    structuredLog("error", `${event}_failed`, requestCorrelationId, {
      error_code: error.code,
      error_name: caught instanceof Error ? caught.name : "unknown",
      database_code: typeof error.causeDetails === "object" && error.causeDetails !== null
        ? (error.causeDetails as Record<string, unknown>).code
        : undefined,
    });
    return jsonResponse(
      request,
      {
        error: { code: error.code, message: error.publicMessage },
        correlation_id: requestCorrelationId,
      },
      error.status,
      requestCorrelationId,
    );
  }
}
