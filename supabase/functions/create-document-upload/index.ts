import { parseCreateDocumentUpload } from "../_shared/contracts.ts";
import { AppError } from "../_shared/errors.ts";
import { handleRequest, jsonResponse, readJson } from "../_shared/http.ts";
import { callRpc, omitSensitive, singleRecord } from "../_shared/rpc.ts";
import {
  assertEvidenceStoragePath,
  EVIDENCE_BUCKET,
  publicStorageUrl,
} from "../_shared/storage.ts";
import { requireUser, userClient } from "../_shared/supabase.ts";
import { requiredUuid } from "../_shared/validation.ts";

interface UploadReservation extends Record<string, unknown> {
  id: string;
  document_id: string;
  storage_path: string;
}

export async function createDocumentUpload(request: Request): Promise<Response> {
  return await handleRequest(request, "create_document_upload", async ({ correlationId }) => {
    const input = parseCreateDocumentUpload(await readJson(request, 24_576));
    const supabase = userClient(request);
    await requireUser(supabase);

    const rpcResult = await callRpc<Record<string, unknown>>(
      supabase,
      "create_document_version",
      {
        target_assessment_id: input.assessmentId,
        target_requirement_id: input.documentRequirementId,
        requested_filename: input.originalFilename,
        requested_mime_type: input.mimeType,
        requested_byte_size: input.byteSize,
        expected_sha256: input.sha256Hash,
        requested_issue_date: input.issueDate,
        requested_expiry_date: input.expiryDate,
        requested_issuing_body: input.issuingBody,
      },
      "The upload reservation could not be created.",
    );
    const reservation = singleRecord<UploadReservation>(
      rpcResult,
      "create_document_upload",
    );
    requiredUuid(reservation.document_id, "document_id");
    requiredUuid(reservation.id, "document_version_id");
    assertEvidenceStoragePath(String(reservation.storage_path ?? ""));

    const { data: upload, error } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUploadUrl(reservation.storage_path);
    if (error || !upload) {
      throw new AppError(
        500,
        "upload_authorization_failed",
        "The secure upload authorization could not be created.",
        error,
      );
    }

    return jsonResponse(
      request,
      {
        bucket: EVIDENCE_BUCKET,
        document_id: reservation.document_id,
        document_version_id: reservation.id,
        storage_path: reservation.storage_path,
        upload_token: upload.token,
        reservation: omitSensitive(reservation),
        upload: {
          path: upload.path,
          signed_url: publicStorageUrl(upload.signedUrl),
          token: upload.token,
          expires_in_seconds: 7_200,
        },
        correlation_id: correlationId,
      },
      201,
      correlationId,
    );
  });
}

Deno.serve(createDocumentUpload);
