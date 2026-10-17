import { requireAdmin } from "@/lib/backend/admin";
import { lookupAdminApplication } from "@/lib/backend/admin-deletion";
import {
  applicationLookupSchema,
  deletionErrorResponse,
} from "@/lib/backend/admin-deletion-validation";
import { ApiError, readJson } from "@/lib/backend/errors";
import { getApplicationOrigin } from "@/lib/backend/env";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const parsed = applicationLookupSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(
        "Enter a valid application URL.",
        422,
        "VALIDATION_ERROR",
      );
    const data = await lookupAdminApplication(
      parsed.data.url,
      getApplicationOrigin(),
    );
    return Response.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return deletionErrorResponse(error);
  }
}
