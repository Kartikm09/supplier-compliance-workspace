import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.8";
import { sha256Hex } from "./crypto.ts";
import { AppError, fromDatabaseError } from "./errors.ts";
import { structuredLog } from "./logging.ts";
import { EVIDENCE_BUCKET, REPORT_BUCKET } from "./storage.ts";
import { requiredUuid } from "./validation.ts";

export const COMPLIANCE_QUEUES = [
  "document_processing",
  "risk_recalculation",
  "report_generation",
  "notification_delivery",
] as const;

export type ComplianceQueue = (typeof COMPLIANCE_QUEUES)[number];

export interface QueueMessage {
  msg_id: number;
  read_ct: number;
  message: Record<string, unknown>;
}

export interface QueueResult {
  attempted: number;
  deadLettered: number;
  failed: number;
  processed: number;
}

export function parseQueueMessage(value: unknown): QueueMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Queue message is malformed.");
  }
  const record = value as Record<string, unknown>;
  if (
    !Number.isInteger(record.msg_id) ||
    !Number.isInteger(record.read_ct) ||
    !record.message ||
    typeof record.message !== "object" ||
    Array.isArray(record.message)
  ) {
    throw new Error("Queue message is malformed.");
  }
  return {
    msg_id: record.msg_id as number,
    read_ct: record.read_ct as number,
    message: record.message as Record<string, unknown>,
  };
}

export function jobPayload(
  queue: ComplianceQueue,
  message: QueueMessage,
  fallbackCorrelationId: string,
): Record<string, string> {
  const suppliedCorrelationId = message.message.correlation_id;
  const correlationId = typeof suppliedCorrelationId === "string" &&
      /^[0-9a-f-]{36}$/i.test(suppliedCorrelationId)
    ? suppliedCorrelationId
    : fallbackCorrelationId;
  const field = queue === "document_processing"
    ? "document_version_id"
    : queue === "notification_delivery"
    ? "notification_id"
    : "assessment_id";
  return {
    [field]: requiredUuid(message.message[field], field),
    correlation_id: correlationId,
  };
}

async function queueRpc(
  client: SupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, parameters);
  if (error) throw fromDatabaseError(error, "queue_operation_failed", "Queue processing failed.");
  return data;
}

async function dispatchInternalApi(
  apiUrl: string,
  apiToken: string,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": apiToken,
        "x-correlation-id": String(payload.correlation_id ?? ""),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new AppError(
        502,
        "internal_service_failed",
        "The internal processing service rejected a job.",
      );
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(500, "invalid_processing_record", `${label} is unavailable.`);
  }
  return value as Record<string, unknown>;
}

async function singleRow(
  client: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  value: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .eq(column, value)
    .single();
  if (error) {
    throw fromDatabaseError(
      error,
      "processing_record_unavailable",
      "A required processing record is unavailable.",
    );
  }
  return recordValue(data, table);
}

function jobMetadata(
  queue: ComplianceQueue,
  message: QueueMessage,
  correlationId: string,
): Record<string, unknown> {
  return {
    attempt: Math.max(1, message.read_ct),
    correlation_id: correlationId,
    job_id: `${queue}:${message.msg_id}`,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

async function processDocumentJob(
  client: SupabaseClient,
  message: QueueMessage,
  payload: Record<string, string>,
  api: { token: string; url: string },
): Promise<void> {
  const version = await singleRow(
    client,
    "document_versions",
    "id, document_id, storage_path, original_filename, mime_type, byte_size, sha256_hash, issue_date, expiry_date, issuing_body",
    "id",
    payload.document_version_id,
  );
  const document = await singleRow(
    client,
    "documents",
    "id, document_requirement_id",
    "id",
    String(version.document_id),
  );

  if (version.mime_type !== "application/pdf") {
    await queueRpc(client, "complete_document_processing", {
      target_document_version_id: payload.document_version_id,
      processing_succeeded: true,
      safe_error_code: null,
    });
    return;
  }

  const { data: blob, error: storageError } = await client.storage
    .from(EVIDENCE_BUCKET)
    .download(String(version.storage_path));
  if (storageError || !blob) {
    throw new AppError(
      502,
      "document_download_failed",
      "The private document could not be retrieved for processing.",
      storageError,
    );
  }

  let rules: Record<string, unknown> = {};
  if (document.document_requirement_id) {
    const requirement = await singleRow(
      client,
      "document_requirements",
      "requires_issue_date, requires_expiry_date, minimum_validity_days, maximum_size_bytes",
      "id",
      String(document.document_requirement_id),
    );
    rules = {
      ...requirement,
      reference_date: new Date().toISOString().slice(0, 10),
    };
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const response = await dispatchInternalApi(
    api.url,
    api.token,
    "/internal/process-document",
    {
      job: jobMetadata(
        "document_processing",
        message,
        payload.correlation_id,
      ),
      document_version_id: payload.document_version_id,
      file_name: String(version.original_filename),
      mime_type: String(version.mime_type),
      content_base64: bytesToBase64(bytes),
      expected_sha256: String(version.sha256_hash),
      issue_date: version.issue_date,
      expiry_date: version.expiry_date,
      issuing_body: version.issuing_body,
      rules,
    },
  );
  const body = recordValue(await response.json(), "document processing response");
  const result = recordValue(body.result, "document processing result");
  const validation = recordValue(result.validation, "document validation");
  await queueRpc(client, "complete_document_processing", {
    target_document_version_id: payload.document_version_id,
    processing_succeeded: validation.valid === true,
    safe_error_code: validation.valid === true ? null : "document_rule_validation_failed",
  });
}

function boundedScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

async function processRiskJob(
  client: SupabaseClient,
  message: QueueMessage,
  payload: Record<string, string>,
  api: { token: string; url: string },
): Promise<void> {
  const assessment = await singleRow(
    client,
    "assessments",
    "id, supplier_relationship_id, status, completeness_percentage",
    "id",
    payload.assessment_id,
  );
  const { count: criticalCount, error: findingError } = await client
    .from("findings")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", payload.assessment_id)
    .eq("severity", "critical")
    .not("status", "in", "(verified,closed)");
  if (findingError) {
    throw fromDatabaseError(findingError);
  }
  const { data: documents, error: documentError } = await client
    .from("documents")
    .select("current_version_id")
    .eq("supplier_relationship_id", String(assessment.supplier_relationship_id))
    .not("current_version_id", "is", null);
  if (documentError) {
    throw fromDatabaseError(documentError);
  }
  const versionIds = (documents ?? [])
    .map((document) => document.current_version_id)
    .filter((value): value is string => typeof value === "string");
  let expiringCount = 0;
  if (versionIds.length > 0) {
    const today = new Date();
    const threshold = new Date(today.getTime() + 30 * 86_400_000);
    const { count, error } = await client
      .from("document_versions")
      .select("id", { count: "exact", head: true })
      .in("id", versionIds)
      .gte("expiry_date", today.toISOString().slice(0, 10))
      .lte("expiry_date", threshold.toISOString().slice(0, 10));
    if (error) throw fromDatabaseError(error);
    expiringCount = count ?? 0;
  }
  const completeness = Number(assessment.completeness_percentage ?? 0);
  const unresolvedCritical = criticalCount ?? 0;
  const factors = [
    { name: "quality_management", score: boundedScore(100 - completeness) },
    {
      name: "information_security",
      score: boundedScore(unresolvedCritical * 30),
    },
    {
      name: "business_continuity",
      score: assessment.status === "changes_requested" ? 55 : 20,
    },
    { name: "document_validity", score: boundedScore(expiringCount * 25) },
    {
      name: "delivery_capability",
      score: ["approved", "conditionally_approved"].includes(String(assessment.status)) ? 10 : 30,
    },
  ];
  const response = await dispatchInternalApi(
    api.url,
    api.token,
    "/internal/recalculate-risk",
    {
      job: jobMetadata("risk_recalculation", message, payload.correlation_id),
      assessment_id: payload.assessment_id,
      calculation_version: "supplier-risk-v1",
      factors,
      unresolved_critical_findings: unresolvedCritical,
      documents_expiring_within_30_days: expiringCount,
    },
  );
  const body = recordValue(await response.json(), "risk processing response");
  const result = recordValue(body.result, "risk processing result");
  await queueRpc(client, "store_risk_evaluation", {
    target_assessment_id: payload.assessment_id,
    calculated_score: result.total_score,
    calculated_level: result.risk_level,
    safe_breakdown: {
      adjustments: result.adjustments,
      calculation_version: result.calculation_version,
      factors: result.scoring_breakdown,
    },
    calculator_type: "system",
  });
}

async function processReportJob(
  client: SupabaseClient,
  message: QueueMessage,
  payload: Record<string, string>,
  api: { token: string; url: string },
): Promise<void> {
  const assessment = await singleRow(
    client,
    "assessments",
    "id, supplier_relationship_id, qualification_program_id, program_version_id, status, completeness_percentage, updated_at",
    "id",
    payload.assessment_id,
  );
  const relationship = await singleRow(
    client,
    "supplier_relationships",
    "id, buyer_organization_id, supplier_organization_id",
    "id",
    String(assessment.supplier_relationship_id),
  );
  const [buyer, supplier, program, version] = await Promise.all([
    singleRow(
      client,
      "organizations",
      "display_name",
      "id",
      String(relationship.buyer_organization_id),
    ),
    singleRow(
      client,
      "organizations",
      "display_name",
      "id",
      String(relationship.supplier_organization_id),
    ),
    singleRow(
      client,
      "qualification_programs",
      "name",
      "id",
      String(assessment.qualification_program_id),
    ),
    singleRow(
      client,
      "program_versions",
      "version_number",
      "id",
      String(assessment.program_version_id),
    ),
  ]);
  const { data: documentRows, error: documentError } = await client
    .from("documents")
    .select("current_version_id, document_requirement_id, status")
    .eq("supplier_relationship_id", String(relationship.id))
    .not("current_version_id", "is", null);
  if (documentError) throw fromDatabaseError(documentError);
  const requirementIds = (documentRows ?? [])
    .map((row) => row.document_requirement_id)
    .filter((value): value is string => typeof value === "string");
  const versionIds = (documentRows ?? [])
    .map((row) => row.current_version_id)
    .filter((value): value is string => typeof value === "string");
  const [{ data: requirementRows }, { data: versionRows }, findingResult] = await Promise.all([
    requirementIds.length
      ? client.from("document_requirements").select("id, name").in("id", requirementIds)
      : Promise.resolve({ data: [] }),
    versionIds.length
      ? client.from("document_versions").select("id, expiry_date").in("id", versionIds)
      : Promise.resolve({ data: [] }),
    client
      .from("findings")
      .select("id, finding_number, severity, title, status")
      .eq("assessment_id", payload.assessment_id)
      .order("finding_number"),
  ]);
  if (findingResult.error) throw fromDatabaseError(findingResult.error);
  const requirementById = new Map(
    (requirementRows ?? []).map((row) => [row.id, row.name]),
  );
  const versionById = new Map(
    (versionRows ?? []).map((row) => [row.id, row.expiry_date]),
  );
  const findingIds = (findingResult.data ?? []).map((row) => row.id);
  const { data: correctiveActions, error: correctiveError } = findingIds.length
    ? await client
      .from("corrective_actions")
      .select("status")
      .in("finding_id", findingIds)
      .order("created_at", { ascending: false })
      .limit(1)
    : { data: [], error: null };
  if (correctiveError) throw fromDatabaseError(correctiveError);
  const { data: decisions, error: decisionError } = await client
    .from("approval_decisions")
    .select("decision")
    .eq("assessment_id", payload.assessment_id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (decisionError) throw fromDatabaseError(decisionError);
  const response = await dispatchInternalApi(
    api.url,
    api.token,
    "/internal/generate-assessment-report",
    {
      job: jobMetadata("report_generation", message, payload.correlation_id),
      assessment_id: payload.assessment_id,
      buyer_name: buyer.display_name,
      supplier_name: supplier.display_name,
      program_name: program.name,
      program_version: version.version_number,
      assessment_status: assessment.status,
      completeness_percentage: assessment.completeness_percentage,
      documents: (documentRows ?? []).map((row) => ({
        name: requirementById.get(row.document_requirement_id) ?? "Qualification evidence",
        status: row.status,
        expiry_date: versionById.get(row.current_version_id) ?? null,
      })),
      findings: findingResult.data ?? [],
      corrective_action_status: correctiveActions?.[0]?.status ?? null,
      decision: decisions?.[0]?.decision ?? null,
      generated_at: assessment.updated_at,
    },
  );
  const contentType = response.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (
    !contentType.startsWith("application/pdf") || bytes.length === 0 || bytes.length > 5_242_880
  ) {
    throw new AppError(
      502,
      "invalid_report_output",
      "The report service returned an invalid document.",
    );
  }
  const digest = await sha256Hex(bytes);
  const storagePath =
    `${relationship.buyer_organization_id}/${relationship.id}/reports/${payload.assessment_id}/${message.msg_id}-${
      digest.slice(0, 12)
    }.pdf`;
  const { error: uploadError } = await client.storage
    .from(REPORT_BUCKET)
    .upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    throw new AppError(
      502,
      "report_storage_failed",
      "The generated report could not be stored.",
      uploadError,
    );
  }
  const { error: metadataError } = await client
    .from("generated_assessment_reports")
    .upsert(
      {
        assessment_id: payload.assessment_id,
        organization_id: relationship.buyer_organization_id,
        supplier_relationship_id: relationship.id,
        storage_path: storagePath,
        byte_size: bytes.length,
        sha256_hash: digest,
      },
      { onConflict: "storage_path" },
    );
  if (metadataError) {
    await client.storage.from(REPORT_BUCKET).remove([storagePath]);
    throw fromDatabaseError(
      metadataError,
      "report_metadata_failed",
      "The generated report metadata could not be stored.",
    );
  }
}

async function dispatchJob(
  client: SupabaseClient,
  queue: ComplianceQueue,
  message: QueueMessage,
  payload: Record<string, string>,
  api: { token: string; url: string },
): Promise<void> {
  if (queue === "notification_delivery") {
    await queueRpc(client, "process_notification_job", {
      target_notification_id: payload.notification_id,
      request_correlation_id: payload.correlation_id,
    });
    return;
  }
  if (queue === "document_processing") {
    await processDocumentJob(client, message, payload, api);
    return;
  }
  if (queue === "risk_recalculation") {
    await processRiskJob(client, message, payload, api);
    return;
  }
  await processReportJob(client, message, payload, api);
}

export async function processQueue(
  client: SupabaseClient,
  queue: ComplianceQueue,
  api: { token: string; url: string },
  requestCorrelationId: string,
): Promise<QueueResult> {
  const rawMessages = await queueRpc(client, "read_compliance_jobs", {
    queue_name: queue,
    visibility_timeout_seconds: 60,
    batch_size: 5,
  });
  const messages = Array.isArray(rawMessages) ? rawMessages.map(parseQueueMessage) : [];
  const result: QueueResult = {
    attempted: messages.length,
    deadLettered: 0,
    failed: 0,
    processed: 0,
  };

  for (const message of messages) {
    try {
      const payload = jobPayload(queue, message, requestCorrelationId);
      await dispatchJob(client, queue, message, payload, api);
      await queueRpc(client, "archive_compliance_job", {
        queue_name: queue,
        message_id: message.msg_id,
      });
      result.processed += 1;
    } catch (error) {
      result.failed += 1;
      structuredLog("warn", "compliance_job_failed", requestCorrelationId, {
        queue,
        message_id: message.msg_id,
        attempt: message.read_ct,
        error_name: error instanceof Error ? error.name : "unknown",
      });
      if (message.read_ct >= 5) {
        await queueRpc(client, "dead_letter_compliance_job", {
          queue_name: queue,
          message_id: message.msg_id,
          payload: message.message,
          failure_code: error instanceof AppError ? error.code : "job_failed",
          attempt_count: message.read_ct,
        });
        result.deadLettered += 1;
      }
    }
  }
  return result;
}
