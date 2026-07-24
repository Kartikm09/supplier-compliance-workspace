const SENSITIVE_KEY =
  /(authorization|cookie|credential|password|secret|token|payload|document_content)/i;

function safeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return value.slice(0, 300);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (typeof value === "object") return "[object]";
  return String(value).slice(0, 100);
}

export function redactLogFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, safeValue(key, value)]),
  );
}

export function structuredLog(
  level: "info" | "warn" | "error",
  event: string,
  correlationId: string,
  fields: Record<string, unknown> = {},
): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    correlation_id: correlationId,
    ...redactLogFields(fields),
  });
  if (level === "error") {
    console.error(entry);
  } else if (level === "warn") {
    console.warn(entry);
  } else {
    console.info(entry);
  }
}
