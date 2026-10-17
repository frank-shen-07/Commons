import { submitDraft, versionSchema } from "@/lib/backend/publisher";
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
    return Response.json(
      {
        data: await submitDraft((await params).id, parsed.data.expectedVersion),
      },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
