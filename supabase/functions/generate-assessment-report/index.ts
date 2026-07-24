import { handleRequest, jsonResponse, readJson } from "../_shared/http.ts";
import { callRpc } from "../_shared/rpc.ts";
import { requireUser, userClient } from "../_shared/supabase.ts";
import { objectValue, requiredUuid } from "../_shared/validation.ts";

export async function generateAssessmentReport(request: Request): Promise<Response> {
  return await handleRequest(request, "generate_assessment_report", async ({ correlationId }) => {
    const body = objectValue(await readJson(request, 8_192));
    const assessmentId = requiredUuid(body.assessment_id, "assessment_id");
    const supabase = userClient(request);
    await requireUser(supabase);
    const jobId = await callRpc<number>(
      supabase,
      "request_assessment_report",
      {
        target_assessment_id: assessmentId,
        request_correlation_id: correlationId,
      },
      "The assessment report could not be queued.",
    );
    return jsonResponse(
      request,
      {
        assessment_id: assessmentId,
        job_id: jobId,
        status: "queued",
        correlation_id: correlationId,
      },
      202,
      correlationId,
    );
  });
}

Deno.serve(generateAssessmentReport);
