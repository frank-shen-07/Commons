import {
  ownedApplication,
  developerListing,
  versionSchema,
} from "@/lib/backend/publisher";
import { createSupabaseAdminClient } from "@/lib/backend/supabase-admin";
import { ApiError, errorResponse, readJson } from "@/lib/backend/errors";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const parsed = versionSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(
        "A saved draft version is required.",
        422,
        "VALIDATION_ERROR",
      );
    const id = (await params).id,
      { user } = await ownedApplication(id);
    const { error } = await createSupabaseAdminClient().rpc(
      "publisher_reopen_revision",
      {
        p_owner: user.id,
        p_application_id: id,
        p_expected_version: parsed.data.expectedVersion,
      },
    );
    if (error) throw error;
    return Response.json(
      { data: await developerListing(id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
