import { parseFinalizeDocumentUpload } from "../_shared/contracts.ts";
import { AppError, fromDatabaseError } from "../_shared/errors.ts";
import { handleRequest, jsonResponse, readJson } from "../_shared/http.ts";
import { callRpc, omitSensitive, singleRecord } from "../_shared/rpc.ts";
import {
  EVIDENCE_BUCKET,
  parseDocumentVersionRecord,
  verifyDocumentBlob,
} from "../_shared/storage.ts";
import { requireUser, serviceClient, userClient } from "../_shared/supabase.ts";

export async function finalizeDocumentUpload(request: Request): Promise<Response> {
  return await handleRequest(request, "finalize_document_upload", async ({ correlationId }) => {
    const input = parseFinalizeDocumentUpload(await readJson(request, 8_192));
    const supabase = userClient(request);
    await requireUser(supabase);

    const { data, error } = await supabase
      .from("document_versions")
      .select(
        "id, storage_path, original_filename, mime_type, byte_size, sha256_hash, upload_status, processing_status",
      )
      .eq("id", input.documentVersionId)
      .single();
    if (error) {
      throw fromDatabaseError(error, "document_lookup_failed", "The document was not found.");
    }
    const documentVersion = parseDocumentVersionRecord(data);
    if (documentVersion.upload_status !== "pending_upload") {
      throw new AppError(409, "upload_already_finalized", "The upload is no longer pending.");
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .download(documentVersion.storage_path);
    if (downloadError || !blob) {
      throw new AppError(
        422,
        "object_not_found",
        "The reserved file has not been uploaded.",
        downloadError,
      );
    }
    const verified = await verifyDocumentBlob(blob, documentVersion);

    const rpcResult = await callRpc<Record<string, unknown>>(
      serviceClient(),
      "finalize_document_upload",
      {
        target_document_version_id: documentVersion.id,
        verified_byte_size: verified.byteSize,
        verified_sha256: verified.sha256Hash,
      },
      "The document upload could not be finalized.",
    );

    return jsonResponse(
      request,
      {
        document_version: omitSensitive(
          singleRecord<Record<string, unknown>>(rpcResult, "finalize_document_upload"),
        ),
        correlation_id: correlationId,
      },
      202,
      correlationId,
    );
  });
}

Deno.serve(finalizeDocumentUpload);
