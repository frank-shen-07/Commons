import { submitDraft } from "@/lib/backend/publisher";
import { errorResponse } from "@/lib/backend/errors";
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    return Response.json(
      { data: await submitDraft((await params).slug) },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
