import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/backend/admin";
import { deleteAdminApplication } from "@/lib/backend/admin-deletion";
import {
  applicationDeletionSchema,
  deletionErrorResponse,
} from "@/lib/backend/admin-deletion-validation";
import { apiUuidSchema } from "@/lib/backend/validation";
import { ApiError, readJson, logServerError } from "@/lib/backend/errors";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!apiUuidSchema.safeParse(id).success)
      throw new ApiError("Application not found.", 404, "NOT_FOUND");
    const parsed = applicationDeletionSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(
        "Provide the exact application slug and its last loaded update time.",
        422,
        "VALIDATION_ERROR",
      );
    const data = await deleteAdminApplication(id, parsed.data);
    // A cache invalidation failure cannot undo an already committed deletion.
    try {
      for (const path of [
        "/",
        "/apps",
        "/explore",
        "/developer",
        "/admin",
        `/apps/${data.slug}`,
      ])
        revalidatePath(path);
      revalidatePath("/apps/[slug]", "page");
    } catch (error) {
      logServerError("Deleted application cache refresh failed", error);
    }
    return Response.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return deletionErrorResponse(error);
  }
}
