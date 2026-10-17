import { getAuthenticatedUser } from "@/lib/backend/auth";
import { errorResponse } from "@/lib/backend/errors";

export async function GET() {
  try {
    const { user } = await getAuthenticatedUser();
    return Response.json({
      data: {
        id: user.id,
        githubUsername: user.identities?.find((identity) => identity.provider === "github")?.identity_data?.user_name ?? user.user_metadata.user_name ?? null,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
