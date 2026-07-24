import { inspectInvitationToken } from "../_shared/crypto.ts";
import { parseAcceptSupplierInvitation } from "../_shared/contracts.ts";
import { AppError } from "../_shared/errors.ts";
import { handleRequest, jsonResponse, readJson } from "../_shared/http.ts";
import { callRpc, omitSensitive, singleRecord } from "../_shared/rpc.ts";
import { requireUser, userClient } from "../_shared/supabase.ts";

export async function acceptSupplierInvitation(request: Request): Promise<Response> {
  return await handleRequest(request, "accept_supplier_invitation", async ({ correlationId }) => {
    const input = parseAcceptSupplierInvitation(await readJson(request, 16_384));
    const supabase = userClient(request);
    await requireUser(supabase);

    let inspected: { prefix: string; hash: string };
    try {
      inspected = await inspectInvitationToken(input.invitationToken);
    } catch {
      throw new AppError(
        409,
        "invitation_unavailable",
        "The invitation is invalid, expired, or has already been used.",
      );
    }

    let result: Record<string, unknown>;
    try {
      result = await callRpc<Record<string, unknown>>(
        supabase,
        "accept_supplier_invitation_with_setup",
        {
          invitation_token_prefix: inspected.prefix,
          invitation_token_hash: inspected.hash,
          target_supplier_organization_id: input.existingSupplierOrganizationId,
          new_supplier_legal_name: input.newSupplier?.legalName ?? null,
          new_supplier_display_name: input.newSupplier?.displayName ?? null,
          new_supplier_slug: input.newSupplier?.slug ?? null,
          new_supplier_country_code: input.newSupplier?.countryCode ?? null,
          request_correlation_id: correlationId,
        },
        "The invitation could not be accepted.",
      );
    } catch (error) {
      if (error instanceof AppError && error.status < 500) {
        throw new AppError(
          409,
          "invitation_unavailable",
          "The invitation is invalid, expired, or has already been used.",
        );
      }
      throw error;
    }

    const relationship = singleRecord<Record<string, unknown>>(
      result,
      "accept_supplier_invitation_with_setup",
    );
    return jsonResponse(
      request,
      {
        relationship: omitSensitive(relationship),
        relationship_id: relationship.id,
        organization_id: relationship.supplier_organization_id,
        correlation_id: correlationId,
      },
      200,
      correlationId,
    );
  });
}

Deno.serve(acceptSupplierInvitation);
