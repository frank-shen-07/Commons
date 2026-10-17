import { persistDraft, saveDraftSchema } from "@/lib/backend/publisher";
import { ApiError, errorResponse, readJson } from "@/lib/backend/errors";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const parsed = saveDraftSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(
        "Listing data is invalid.",
        422,
        "VALIDATION_ERROR",
        parsed.error.issues,
      );
    return Response.json(
      {
        data: await persistDraft(
          parsed.data.input,
          (await params).id,
          parsed.data.expectedVersion,
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
