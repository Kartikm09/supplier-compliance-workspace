import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.8";
import { AppError } from "./errors.ts";
import { requireBearerToken } from "./security.ts";

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new AppError(500, "configuration_error", "The function is not configured correctly.");
  }
  return value;
}

export function userClient(request: Request): SupabaseClient {
  const bearerToken = requireBearerToken(request);
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

export function serviceClient(): SupabaseClient {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function requireUser(client: SupabaseClient): Promise<{ id: string }> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new AppError(401, "unauthorized", "Authentication is required.", error);
  return { id: user.id };
}

export function requiredInternalFunctionToken(): string {
  return requiredEnvironment("INTERNAL_FUNCTION_TOKEN");
}

export function requiredInternalApiConfiguration(): { token: string; url: string } {
  return {
    token: requiredEnvironment("INTERNAL_API_TOKEN"),
    url: requiredEnvironment("INTERNAL_API_URL").replace(/\/+$/, ""),
  };
}
