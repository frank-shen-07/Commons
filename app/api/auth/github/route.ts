import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/backend/supabase";
import { getApplicationOrigin } from "@/lib/backend/env";
import { errorResponse } from "@/lib/backend/errors";

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const requestUrl = new URL(request.url);
    const origin = getApplicationOrigin();
    const next = requestUrl.searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(safeNext)}`,
        scopes: "read:user public_repo",
        queryParams: { allow_signup: "true" },
      },
    });
    if (error || !data.url) throw error ?? new Error("OAuth authorization URL was not returned.");
    return NextResponse.redirect(data.url);
  } catch (error) {
    return errorResponse(error);
  }
}
