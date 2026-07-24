import { parseGetSignedDocumentUrl } from "../_shared/contracts.ts";
import { AppError, fromDatabaseError } from "../_shared/errors.ts";
import { handleRequest, jsonResponse, readJson } from "../_shared/http.ts";
import { EVIDENCE_BUCKET, parseDocumentVersionRecord } from "../_shared/storage.ts";
import { requireUser, userClient } from "../_shared/supabase.ts";

export async function getSignedDocumentUrl(request: Request): Promise<Response> {
  return await handleRequest(request, "get_signed_document_url", async ({ correlationId }) => {
    const input = parseGetSignedDocumentUrl(await readJson(request, 8_192));
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
    if (documentVersion.upload_status === "pending_upload") {
      throw new AppError(409, "document_not_ready", "The document is not available for download.");
    }

    const { data: signed, error: signingError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(documentVersion.storage_path, input.expiresInSeconds, {
        download: documentVersion.original_filename,
      });
    if (signingError || !signed) {
      throw new AppError(
        500,
        "signed_url_failed",
        "A secure document URL could not be created.",
        signingError,
      );
    }

    return jsonResponse(
      request,
      {
        document_version_id: documentVersion.id,
        signed_url: signed.signedUrl,
        expires_in_seconds: input.expiresInSeconds,
        correlation_id: correlationId,
      },
      200,
      correlationId,
    );
  });
}

Deno.serve(getSignedDocumentUrl);
