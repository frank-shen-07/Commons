import {
  getAuthenticatedUser,
  getGithubProviderToken,
} from "@/lib/backend/auth";
import { errorResponse } from "@/lib/backend/errors";
import { verifyGithubRepository, readGithubReadme } from "@/lib/backend/github";
import { verifiedRepository } from "@/lib/backend/publishing-snapshot";
export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const token = await getGithubProviderToken(supabase, user);
    const result = await verifyGithubRepository(
      new URL(request.url).searchParams.get("repository") ?? "",
      token,
    );
    const imported = verifiedRepository(
      result.repository,
      result.releases,
      await readGithubReadme(result.repository.full_name, token),
    );
    return Response.json(
      { data: { ...imported, repository: imported } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
