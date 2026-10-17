import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database.types";
import { getBackendEnv } from "./env";
import { ApiError } from "./errors";

export function createSupabaseAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getBackendEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new ApiError("Server-side listing persistence is not configured.", 503, "SUPABASE_ADMIN_UNAVAILABLE");
  }
  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
