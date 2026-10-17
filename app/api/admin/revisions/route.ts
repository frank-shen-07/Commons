import { pendingAdminRevisions } from "@/lib/backend/admin";
import { adminErrorResponse } from "@/lib/backend/admin-access";
export async function GET() {
  try {
    return Response.json(
      { data: await pendingAdminRevisions() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
