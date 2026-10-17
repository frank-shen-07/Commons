import "server-only";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database.types";
import { requireAuthenticatedUser, requireGithubProviderToken } from "./oauth-flow";
import { createSupabaseServerClient } from "./supabase";

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: requireAuthenticatedUser(user, error) };
}

export async function getGithubProviderToken(supabase: SupabaseClient<Database>, user: User): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return requireGithubProviderToken(null, user);
  return requireGithubProviderToken(session, user);
}

export function githubUsername(user: User): string | null {
  const identities = user.identities ?? [];
  const identity = identities.find((item) => item.provider === "github");
  const metadata = identity?.identity_data;
  const username = metadata && typeof metadata.user_name === "string"
    ? metadata.user_name
    : metadata && typeof metadata.preferred_username === "string"
      ? metadata.preferred_username
      : user.user_metadata.user_name;
  return typeof username === "string" && username.length > 0 ? username : null;
}
