import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/backend/supabase";
import { getApplicationOrigin } from "@/lib/backend/env";
import { resolveOAuthCallback } from "@/lib/backend/oauth-flow";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let origin: string;
  try {
    origin = getApplicationOrigin();
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: { code: "CONFIGURATION_ERROR", message: error.message } }, { status: 503 });
    }
    return NextResponse.json({ error: { code: "CONFIGURATION_ERROR", message: "OAuth application origin is not configured." } }, { status: 503 });
  }
  const location = await resolveOAuthCallback({
    code: url.searchParams.get("code"),
    next: url.searchParams.get("next"),
    origin,
    exchangeCodeForSession: async (code) => {
      const supabase = await createSupabaseServerClient();
      return supabase.auth.exchangeCodeForSession(code);
    },
  });
  return NextResponse.redirect(location);
}
