import { getAuthenticatedUser, githubUsername } from "@/lib/backend/auth";
import { ApiError, errorResponse, readJson } from "@/lib/backend/errors";
import { profileSchema, safeExternalHttps } from "@/lib/backend/validation";
import { createSupabaseAdminClient } from "@/lib/backend/supabase-admin";
import type { Database } from "@/src/types/database.types";

type ProfileRow = Database["public"]["Tables"]["developer_profiles"]["Row"];

function serializeProfile(profile: ProfileRow) {
  return {
    userId: profile.user_id,
    githubUsername: profile.github_username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    biography: profile.biography,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

export async function GET() {
  try {
    const { user } = await getAuthenticatedUser();
    const supabase = createSupabaseAdminClient();
    const username = githubUsername(user);
    if (!username) throw new ApiError("The authenticated account is not connected to GitHub.", 403, "GITHUB_IDENTITY_MISSING");
    const { data, error } = await supabase.from("developer_profiles").upsert({
      user_id: user.id,
      github_username: username,
      display_name: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : username,
      avatar_url: safeExternalHttps(typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : null),
    }, { onConflict: "user_id", ignoreDuplicates: true }).select("*").maybeSingle();
    if (error) throw error;
    if (data) return Response.json({ data: serializeProfile(data) }, { headers: { "Cache-Control": "no-store" } });
    const { data: existing, error: readError } = await supabase.from("developer_profiles").select("*").eq("user_id", user.id).single();
    if (readError) throw readError;
    return Response.json({ data: serializeProfile(existing) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const parsed = profileSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError("Profile update is invalid.", 422, "VALIDATION_ERROR", parsed.error.issues);
    const { user } = await getAuthenticatedUser();
    const supabase = createSupabaseAdminClient();
    const username = githubUsername(user);
    if (!username) throw new ApiError("The authenticated account is not connected to GitHub.", 403, "GITHUB_IDENTITY_MISSING");
    const update = parsed.data;
    const { data: current, error: currentError } = await supabase.from("developer_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (currentError) throw currentError;
    const { data, error } = await supabase.from("developer_profiles").upsert({
      user_id: user.id,
      github_username: username,
      display_name: update.displayName ?? current?.display_name ?? (typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : username),
      biography: update.biography !== undefined ? update.biography : current?.biography ?? null,
      avatar_url: update.avatarUrl !== undefined ? update.avatarUrl : current?.avatar_url ?? safeExternalHttps(typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : null),
    }, { onConflict: "user_id" }).select("*").single();
    if (error) throw error;
    return Response.json({ data: serializeProfile(data) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
