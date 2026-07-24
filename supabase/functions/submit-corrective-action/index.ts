import { parseSubmitCorrectiveAction } from "../_shared/contracts.ts";
import { handleRequest, jsonResponse, readJson } from "../_shared/http.ts";
import { callRpc, omitSensitive, singleRecord } from "../_shared/rpc.ts";
import { requireUser, userClient } from "../_shared/supabase.ts";

export async function submitCorrectiveAction(request: Request): Promise<Response> {
  return await handleRequest(request, "submit_corrective_action", async ({ correlationId }) => {
    const input = parseSubmitCorrectiveAction(await readJson(request, 24_576));
    const supabase = userClient(request);
    await requireUser(supabase);
    const result = await callRpc<Record<string, unknown>>(
      supabase,
      "submit_corrective_action",
      {
        target_finding_id: input.findingId,
        root_cause_text: input.rootCause,
        correction_text: input.correction,
        preventive_action_text: input.preventiveAction,
        completion_target: input.targetCompletionDate,
      },
      "The corrective action could not be submitted.",
    );
    return jsonResponse(
      request,
      {
        ...omitSensitive(singleRecord<Record<string, unknown>>(
          result,
          "submit_corrective_action",
        )),
        correlation_id: correlationId,
      },
      201,
      correlationId,
    );
  });
}

Deno.serve(submitCorrectiveAction);
