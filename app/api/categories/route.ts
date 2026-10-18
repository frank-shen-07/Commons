import { createSupabasePublicClient } from "@/lib/backend/supabase";
import { errorResponse } from "@/lib/backend/errors";

export async function GET() {
  try {
    const supabase = createSupabasePublicClient();
    const [{ data: categories, error }, { data: links, error: linkError }] = await Promise.all([
      supabase.from("categories").select("id, name, slug").order("name"),
      supabase.from("application_categories").select("category_id"),
    ]);
    if (error) throw error;
    if (linkError) throw linkError;
    const counts = new Map<string, number>();
    for (const row of links ?? []) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    return Response.json({ data: (categories ?? []).map((category) => ({ ...category, applicationCount: counts.get(category.id) ?? 0 })) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
