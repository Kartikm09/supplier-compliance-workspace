import { handleRequest, jsonResponse } from "../_shared/http.ts";
import { COMPLIANCE_QUEUES, processQueue } from "../_shared/queue.ts";
import { requireInternalToken } from "../_shared/security.ts";
import {
  requiredInternalApiConfiguration,
  requiredInternalFunctionToken,
  serviceClient,
} from "../_shared/supabase.ts";

export async function processQueues(request: Request): Promise<Response> {
  return await handleRequest(request, "process_queues", async ({ correlationId }) => {
    requireInternalToken(request, requiredInternalFunctionToken());
    const client = serviceClient();
    const api = requiredInternalApiConfiguration();
    const results = await Promise.all(
      COMPLIANCE_QUEUES.map(async (queue) =>
        [
          queue,
          await processQueue(
            client,
            queue,
            api,
            correlationId,
          ),
        ] as const
      ),
    );

    return jsonResponse(
      request,
      {
        queues: Object.fromEntries(results),
        correlation_id: correlationId,
      },
      200,
      correlationId,
    );
  });
}

Deno.serve(processQueues);
