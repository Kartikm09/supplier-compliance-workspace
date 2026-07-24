import { parseCreateFinding } from "../_shared/contracts.ts";
import { handleRequest, jsonResponse, readJson } from "../_shared/http.ts";
import { callRpc, omitSensitive, singleRecord } from "../_shared/rpc.ts";
import { requireUser, userClient } from "../_shared/supabase.ts";

export async function createFinding(request: Request): Promise<Response> {
  return await handleRequest(request, "create_finding", async ({ correlationId }) => {
    const input = parseCreateFinding(await readJson(request, 24_576));
    const supabase = userClient(request);
    await requireUser(supabase);
    const result = await callRpc<Record<string, unknown>>(
      supabase,
      "create_assessment_finding",
      {
        target_assessment_id: input.assessmentId,
        requested_severity: input.severity,
        requested_category: input.category,
        requested_title: input.title,
        supplier_description: input.description,
        buyer_internal_note: input.internalNote,
        supplier_assignee: input.assignedSupplierUserId,
        requested_due_at: input.dueAt,
      },
      "The finding could not be created.",
    );
    return jsonResponse(
      request,
      {
        ...omitSensitive(singleRecord<Record<string, unknown>>(
          result,
          "create_assessment_finding",
        )),
        correlation_id: correlationId,
      },
      201,
      correlationId,
    );
  });
}

Deno.serve(createFinding);
