import { parseSubmitAssessment } from "../_shared/contracts.ts";
import { handleRequest, jsonResponse, readJson } from "../_shared/http.ts";
import { callRpc, omitSensitive, singleRecord } from "../_shared/rpc.ts";
import { requireUser, userClient } from "../_shared/supabase.ts";

export async function submitAssessment(request: Request): Promise<Response> {
  return await handleRequest(request, "submit_assessment", async ({ correlationId }) => {
    const input = parseSubmitAssessment(await readJson(request, 16_384));
    const supabase = userClient(request);
    await requireUser(supabase);
    const result = await callRpc<Record<string, unknown>>(
      supabase,
      "submit_assessment",
      {
        target_assessment_id: input.assessmentId,
        declaration_text: input.supplierDeclaration,
      },
      "The assessment could not be submitted.",
    );
    return jsonResponse(
      request,
      {
        ...omitSensitive(singleRecord<Record<string, unknown>>(result, "submit_assessment")),
        correlation_id: correlationId,
      },
      200,
      correlationId,
    );
  });
}

Deno.serve(submitAssessment);
