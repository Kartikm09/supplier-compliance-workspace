import { generateInvitationToken } from "../_shared/crypto.ts";
import { parseCreateSupplierInvitation } from "../_shared/contracts.ts";
import { handleRequest, jsonResponse, readJson } from "../_shared/http.ts";
import { callRpc, omitSensitive, singleRecord } from "../_shared/rpc.ts";
import { requireUser, userClient } from "../_shared/supabase.ts";

export async function createSupplierInvitation(request: Request): Promise<Response> {
  return await handleRequest(request, "create_supplier_invitation", async ({ correlationId }) => {
    const input = parseCreateSupplierInvitation(await readJson(request, 16_384));
    const supabase = userClient(request);
    await requireUser(supabase);

    const oneTimeToken = await generateInvitationToken();
    const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1_000).toISOString();
    const result = await callRpc<Record<string, unknown>>(
      supabase,
      "create_supplier_invitation",
      {
        target_buyer_organization_id: input.buyerOrganizationId,
        requested_supplier_name: input.intendedSupplierName,
        requested_email: input.invitedEmail,
        generated_token_prefix: oneTimeToken.prefix,
        generated_token_hash: oneTimeToken.hash,
        requested_expiry: expiresAt,
      },
      "The supplier invitation could not be created.",
    );
    const invitation = omitSensitive(
      singleRecord<Record<string, unknown>>(result, "create_supplier_invitation"),
    );

    return jsonResponse(
      request,
      {
        invitation,
        invitation_id: invitation.id,
        token: oneTimeToken.token,
        expires_at: expiresAt,
        warning: "The invitation token is displayed once and cannot be recovered.",
        correlation_id: correlationId,
      },
      201,
      correlationId,
    );
  });
}

Deno.serve(createSupplierInvitation);
