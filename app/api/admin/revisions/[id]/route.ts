import { adminRevision, requireAdmin } from "@/lib/backend/admin";
import { adminErrorResponse } from "@/lib/backend/admin-access";
import { apiUuidSchema } from "@/lib/backend/validation";
import { ApiError } from "@/lib/backend/errors";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!apiUuidSchema.safeParse(id).success)
      throw new ApiError("Submission not found.", 404, "NOT_FOUND");
    return Response.json(
      { data: await adminRevision(id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
