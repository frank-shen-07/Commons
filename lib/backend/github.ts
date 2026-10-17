import "server-only";
import { ApiError } from "./errors";
import { repositoryName } from "../publishing/validation";

export interface GithubRepository {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  private: boolean;
  archived: boolean;
  html_url: string;
  homepage: string | null;
  owner: { login: string; avatar_url: string };
  license: { spdx_id: string } | null;
  permissions?: { admin?: boolean; maintain?: boolean; push?: boolean };
}

export interface GithubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  published_at: string | null;
  body: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  assets: Array<{
    id: number;
    name: string;
    size: number;
    content_type: string | null;
    browser_download_url: string;
    state: string;
  }>;
}

async function githubRequest<T>(path: string, token: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Commons-Marketplace",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiError(
        "GitHub did not respond in time. Try again later.",
        504,
        "GITHUB_TIMEOUT",
      );
    }
    throw new ApiError(
      "GitHub could not be reached. Try again later.",
      502,
      "GITHUB_UNAVAILABLE",
    );
  }
  if (
    response.status === 429 ||
    (response.status === 403 &&
      response.headers.get("x-ratelimit-remaining") === "0")
  ) {
    throw new ApiError(
      "GitHub's request limit was reached. Try again later.",
      429,
      "GITHUB_LIMIT",
    );
  }
  if (response.status === 403) {
    throw new ApiError(
      "Your connected GitHub account does not have repository access.",
      403,
      "GITHUB_FORBIDDEN",
    );
  }
  if (response.status === 404)
    throw new ApiError(
      "GitHub repository or release was not found.",
      404,
      "GITHUB_NOT_FOUND",
    );
  if (response.status === 401)
    throw new ApiError(
      "GitHub authorization expired. Connect GitHub again.",
      401,
      "GITHUB_UNAUTHORIZED",
    );
  if (!response.ok)
    throw new ApiError(
      "GitHub could not verify this repository.",
      502,
      "GITHUB_FAILURE",
    );
  return response.json() as Promise<T>;
}

export async function verifyGithubRepository(value: string, token: string) {
  let canonical: string;
  try {
    canonical = repositoryName(value);
  } catch {
    throw new ApiError(
      "Enter a valid github.com owner/repository URL.",
      422,
      "INVALID_REPOSITORY",
    );
  }
  const repository = await githubRequest<GithubRepository>(
    `/repos/${canonical}`,
    token,
  );
  if (repository.private || repository.archived) {
    throw new ApiError(
      "Only public, active repositories can be published.",
      422,
      "REPOSITORY_UNAVAILABLE",
    );
  }
  if (
    !repository.permissions?.push &&
    !repository.permissions?.maintain &&
    !repository.permissions?.admin
  ) {
    throw new ApiError(
      "Your connected GitHub account does not have repository write access.",
      403,
      "REPOSITORY_FORBIDDEN",
    );
  }
  return {
    repository,
    releases: await githubRequest<GithubRelease[]>(
      `/repos/${canonical}/releases?per_page=20`,
      token,
    ),
  };
}

export async function readGithubReadme(
  fullName: string,
  token: string,
): Promise<string> {
  try {
    const result = await githubRequest<{ content: string; encoding: string }>(
      `/repos/${fullName}/readme`,
      token,
    );
    return result.encoding === "base64"
      ? Buffer.from(result.content, "base64").toString("utf8").slice(0, 30000)
      : "";
  } catch {
    return "";
  } // README is optional; verification failures are not swallowed.
}
