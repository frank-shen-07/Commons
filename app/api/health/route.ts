import { createSupabaseServerClient } from "@/lib/backend/supabase";
import { logServerError } from "@/lib/backend/errors";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("categories").select("id").limit(1);
    if (error) throw error;
    return Response.json({ status: "ok", database: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logServerError("Health check failed", error);
    return Response.json({ status: "unavailable", database: "unavailable" }, { status: 503 });
  }
}
