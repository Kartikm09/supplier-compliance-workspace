import { AppError } from "./errors.ts";

export type JsonObject = Record<string, unknown>;

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function objectValue(value: unknown, field = "request body"): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(422, "invalid_request", `${field} must be a JSON object.`);
  }
  return value as JsonObject;
}

export function requiredString(
  value: unknown,
  field: string,
  options: { minimum?: number; maximum?: number } = {},
): string {
  if (typeof value !== "string") {
    throw new AppError(422, "invalid_field", `${field} must be a string.`);
  }
  const normalized = value.trim();
  const minimum = options.minimum ?? 1;
  const maximum = options.maximum ?? 2_000;
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new AppError(
      422,
      "invalid_field",
      `${field} must be between ${minimum} and ${maximum} characters.`,
    );
  }
  return normalized;
}

export function optionalString(
  value: unknown,
  field: string,
  maximum = 2_000,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requiredString(value, field, { maximum });
}

export function requiredUuid(value: unknown, field: string): string {
  const uuid = requiredString(value, field, { maximum: 36 });
  if (!UUID_PATTERN.test(uuid)) {
    throw new AppError(422, "invalid_field", `${field} must be a valid UUID.`);
  }
  return uuid.toLowerCase();
}

export function optionalUuid(value: unknown, field: string): string | null {
  return value === undefined || value === null || value === "" ? null : requiredUuid(value, field);
}

export function requiredEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  const candidate = requiredString(value, field, { maximum: 80 }) as T;
  if (!allowed.includes(candidate)) {
    throw new AppError(422, "invalid_field", `${field} contains an unsupported value.`);
  }
  return candidate;
}

export function optionalInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new AppError(
      422,
      "invalid_field",
      `${field} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return value as number;
}

export function requiredPositiveInteger(
  value: unknown,
  field: string,
  maximum: number,
): number {
  if (value === undefined || value === null) {
    throw new AppError(422, "invalid_field", `${field} is required.`);
  }
  return optionalInteger(value, field, 1, maximum, 1);
}

export function emailAddress(value: unknown, field: string): string {
  const email = requiredString(value, field, { maximum: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(422, "invalid_field", `${field} must be a valid email address.`);
  }
  return email;
}

export function countryCode(value: unknown, field: string): string {
  const code = requiredString(value, field, { minimum: 2, maximum: 2 }).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    throw new AppError(422, "invalid_field", `${field} must be an ISO alpha-2 country code.`);
  }
  return code;
}

export function isoDate(value: unknown, field: string, optional = false): string | null {
  if (optional && (value === undefined || value === null || value === "")) return null;
  const date = requiredString(value, field, { minimum: 10, maximum: 10 });
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new AppError(422, "invalid_field", `${field} must use YYYY-MM-DD.`);
  }
  return date;
}

export function isoTimestamp(value: unknown, field: string): string {
  const timestamp = requiredString(value, field, { minimum: 20, maximum: 40 });
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      timestamp,
    ) ||
    Number.isNaN(Date.parse(timestamp))
  ) {
    throw new AppError(
      422,
      "invalid_field",
      `${field} must be an ISO-8601 timestamp with a timezone.`,
    );
  }
  return timestamp;
}

export function sha256Digest(value: unknown, field: string): string {
  const digest = requiredString(value, field, { minimum: 64, maximum: 64 }).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    throw new AppError(422, "invalid_field", `${field} must be a SHA-256 hex digest.`);
  }
  return digest;
}

export function safeFilename(value: unknown): string {
  const original = requiredString(value, "original_filename", { maximum: 180 });
  const withoutPath = original.replaceAll("\\", "/").split("/").at(-1) ?? "";
  const sanitized = withoutPath
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);
  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new AppError(422, "invalid_filename", "The filename is not supported.");
  }
  return sanitized;
}
