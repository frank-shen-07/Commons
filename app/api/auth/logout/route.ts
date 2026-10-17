import { createSupabaseServerClient } from "@/lib/backend/supabase";
import { errorResponse } from "@/lib/backend/errors";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return Response.json({ data: { signedOut: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
