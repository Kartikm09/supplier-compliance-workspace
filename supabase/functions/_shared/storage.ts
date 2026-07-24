import { AppError } from "./errors.ts";
import { sha256Hex } from "./crypto.ts";
import { UUID_PATTERN } from "./validation.ts";

export const EVIDENCE_BUCKET = "supplier-evidence";
export const REPORT_BUCKET = "assessment-reports";
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export function publicStorageUrl(
  signedUrl: string,
  publicSupabaseUrl = Deno.env.get("PUBLIC_SUPABASE_URL"),
): string {
  if (!publicSupabaseUrl) return signedUrl;
  try {
    const signed = new URL(signedUrl);
    const external = new URL(publicSupabaseUrl);
    signed.protocol = external.protocol;
    signed.host = external.host;
    return signed.toString();
  } catch {
    throw new AppError(
      500,
      "invalid_storage_configuration",
      "The public Storage URL is not configured correctly.",
    );
  }
}

export interface DocumentVersionRecord {
  id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  sha256_hash: string;
  upload_status: string;
  processing_status: string;
}

export function assertEvidenceStoragePath(path: string): void {
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new AppError(500, "invalid_storage_record", "The document storage record is invalid.");
  }
  const segments = path.split("/");
  if (
    segments.length !== 5 ||
    !UUID_PATTERN.test(segments[0] ?? "") ||
    !UUID_PATTERN.test(segments[1] ?? "") ||
    !UUID_PATTERN.test(segments[2] ?? "") ||
    !/^[1-9]\d*$/.test(segments[3] ?? "") ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(segments[4] ?? "")
  ) {
    throw new AppError(500, "invalid_storage_record", "The document storage record is invalid.");
  }
}

export function parseDocumentVersionRecord(value: unknown): DocumentVersionRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(404, "document_not_found", "The document version was not found.");
  }
  const record = value as Record<string, unknown>;
  const parsed: DocumentVersionRecord = {
    id: String(record.id ?? ""),
    storage_path: String(record.storage_path ?? ""),
    original_filename: String(record.original_filename ?? ""),
    mime_type: String(record.mime_type ?? ""),
    byte_size: Number(record.byte_size),
    sha256_hash: String(record.sha256_hash ?? "").toLowerCase(),
    upload_status: String(record.upload_status ?? ""),
    processing_status: String(record.processing_status ?? ""),
  };
  if (
    !UUID_PATTERN.test(parsed.id) ||
    !Number.isInteger(parsed.byte_size) ||
    parsed.byte_size < 1 ||
    parsed.byte_size > MAX_EVIDENCE_BYTES ||
    !/^[0-9a-f]{64}$/.test(parsed.sha256_hash)
  ) {
    throw new AppError(500, "invalid_storage_record", "The document storage record is invalid.");
  }
  assertEvidenceStoragePath(parsed.storage_path);
  return parsed;
}

export async function verifyDocumentBlob(
  blob: Blob,
  expected: DocumentVersionRecord,
): Promise<{ byteSize: number; mimeType: string; sha256Hash: string }> {
  if (blob.size !== expected.byte_size) {
    throw new AppError(
      422,
      "size_mismatch",
      "The uploaded file size does not match its reservation.",
    );
  }
  if (blob.size > MAX_EVIDENCE_BYTES) {
    throw new AppError(413, "file_too_large", "The uploaded file exceeds the permitted size.");
  }
  const observedMime = (blob.type || "application/octet-stream")
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  const expectedMime = expected.mime_type.trim().toLowerCase();
  if (observedMime !== "application/octet-stream" && observedMime !== expectedMime) {
    throw new AppError(
      422,
      "mime_type_mismatch",
      "The uploaded file type does not match its reservation.",
    );
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const observedHash = await sha256Hex(bytes);
  if (observedHash !== expected.sha256_hash) {
    throw new AppError(
      422,
      "checksum_mismatch",
      "The uploaded file checksum does not match its reservation.",
    );
  }
  return {
    byteSize: blob.size,
    mimeType: expected.mime_type,
    sha256Hash: observedHash,
  };
}
