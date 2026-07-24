import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.8";
import { fromDatabaseError } from "./errors.ts";

export async function callRpc<T>(
  client: SupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
  fallbackMessage: string,
): Promise<T> {
  const { data, error } = await client.rpc(name, parameters);
  if (error) throw fromDatabaseError(error, `${name}_failed`, fallbackMessage);
  return data as T;
}

export function singleRecord<T extends Record<string, unknown>>(
  value: unknown,
  operation: string,
): T {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`${operation} did not return a record.`);
  }
  return candidate as T;
}

export function omitSensitive<T extends Record<string, unknown>>(record: T): Partial<T> {
  const blocked = new Set([
    "invitation_token_hash",
    "token_hash",
    "token_prefix",
    "service_role_key",
    "internal_note",
    "internal_rationale",
  ]);
  return Object.fromEntries(Object.entries(record).filter(([key]) => !blocked.has(key))) as Partial<
    T
  >;
}
