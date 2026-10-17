import { getAuthenticatedUser } from "@/lib/backend/auth";
import { ApiError, errorResponse, readJson } from "@/lib/backend/errors";
import { apiUuidSchema, reportSchema } from "@/lib/backend/validation";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { slug: id } = await params;
    if (!apiUuidSchema.safeParse(id).success) throw new ApiError("Invalid application ID.", 400, "INVALID_ID");
    const parsed = reportSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError("Report data is invalid.", 422, "VALIDATION_ERROR", parsed.error.issues);
    const { supabase, user } = await getAuthenticatedUser();
    const { data: app, error: appError } = await supabase.from("applications").select("id").eq("id", id).eq("status", "published").maybeSingle();
    if (appError) throw appError;
    if (!app) throw new ApiError("Application not found.", 404, "NOT_FOUND");
    const { data, error } = await supabase.from("application_reports").insert({
      application_id: app.id,
      reporter_id: user.id,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
    }).select("id, created_at").single();
    if (error) throw error;
    return Response.json({ data: { id: data.id, createdAt: data.created_at } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
