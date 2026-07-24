import { parseRecordApprovalDecision } from "../_shared/contracts.ts";
import { handleRequest, jsonResponse, readJson } from "../_shared/http.ts";
import { callRpc, omitSensitive, singleRecord } from "../_shared/rpc.ts";
import { requireUser, userClient } from "../_shared/supabase.ts";

export async function recordApprovalDecision(request: Request): Promise<Response> {
  return await handleRequest(request, "record_approval_decision", async ({ correlationId }) => {
    const input = parseRecordApprovalDecision(await readJson(request, 24_576));
    const supabase = userClient(request);
    await requireUser(supabase);
    const result = await callRpc<Record<string, unknown>>(
      supabase,
      "record_approval_decision",
      {
        target_assessment_id: input.assessmentId,
        requested_decision: input.decision,
        requested_effective_from: input.effectiveFrom,
        requested_valid_until: input.validUntil,
        supplier_conditions: input.conditions,
        buyer_internal_rationale: input.internalRationale,
      },
      "The approval decision could not be recorded.",
    );
    return jsonResponse(
      request,
      {
        ...omitSensitive(singleRecord<Record<string, unknown>>(
          result,
          "record_approval_decision",
        )),
        correlation_id: correlationId,
      },
      201,
      correlationId,
    );
  });
}

Deno.serve(recordApprovalDecision);
