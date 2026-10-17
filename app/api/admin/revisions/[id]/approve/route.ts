import { approveAdminRevision, requireAdmin } from "@/lib/backend/admin";
import {
  adminApprovalSchema,
  adminErrorResponse,
} from "@/lib/backend/admin-access";
import { apiUuidSchema } from "@/lib/backend/validation";
import { ApiError, readJson } from "@/lib/backend/errors";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!apiUuidSchema.safeParse(id).success)
      throw new ApiError("Submission not found.", 404, "NOT_FOUND");
    const parsed = adminApprovalSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(
        "A positive saved submission version is required.",
        422,
        "VALIDATION_ERROR",
      );
    return Response.json(
      { data: await approveAdminRevision(id, parsed.data.expectedVersion) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
