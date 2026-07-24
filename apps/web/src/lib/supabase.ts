import type { Database } from "@scw/contracts";
import { createClient } from "@supabase/supabase-js";

import { environment } from "../env";

export const supabase = createClient<Database>(
  environment.VITE_SUPABASE_URL,
  environment.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  },
);

interface EdgeFunctionResponse<T> {
  data: T | null;
  error: Error | null;
}

export async function invokeEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = (await supabase.functions.invoke<T>(name, {
    body,
  })) as EdgeFunctionResponse<T>;
  if (response.error) throw response.error;
  if (response.data === null) {
    throw new Error(`${name} returned no result.`);
  }
  return response.data;
}
