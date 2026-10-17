import { developerListing } from "@/lib/backend/publisher";
import { errorResponse } from "@/lib/backend/errors";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      { data: await developerListing((await params).id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
