export interface PublicGithubRepository {
  fullName: string;
  description: string | null;
  stars: number;
  language: string | null;
  avatarUrl: string;
}

interface GithubRepositoryResponse {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  html_url: string;
  owner: { avatar_url: string };
  archived: boolean;
  private: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGithubRepository(
  value: unknown,
): value is GithubRepositoryResponse {
  if (!isRecord(value)) return false;
  const owner = isRecord(value.owner) ? value.owner : null;
  return (
    typeof value.full_name === "string" &&
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.full_name) &&
    (typeof value.description === "string" || value.description === null) &&
    Number.isSafeInteger(value.stargazers_count) &&
    (typeof value.language === "string" || value.language === null) &&
    typeof value.html_url === "string" &&
    owner !== null &&
    typeof owner.avatar_url === "string" &&
    typeof value.archived === "boolean" &&
    typeof value.private === "boolean"
  );
}

export async function searchPublicGithubRepositories(
  query: string,
  signal: AbortSignal,
): Promise<PublicGithubRepository[]> {
  const params = new URLSearchParams({
    q: `${query.trim()} is:public archived:false`,
    sort: "stars",
    order: "desc",
    per_page: "20",
  });
  const response = await fetch(
    `https://api.github.com/search/repositories?${params}`,
    {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    },
  );
  if (response.status === 403 || response.status === 429) {
    throw new Error(
      "GitHub search is rate limited right now. Wait a minute, then try again.",
    );
  }
  if (!response.ok) {
    throw new Error("GitHub could not search public repositories. Try again.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("GitHub returned an unreadable search response.");
  }
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.items) ||
    !payload.items.every(isGithubRepository)
  ) {
    throw new Error("GitHub returned search results in an unexpected format.");
  }

  return payload.items
    .filter((repository) => !repository.private && !repository.archived)
    .map((repository) => ({
      fullName: repository.full_name,
      description: repository.description,
      stars: repository.stargazers_count,
      language: repository.language,
      avatarUrl: isSafeGithubAvatar(repository.owner.avatar_url)
        ? repository.owner.avatar_url
        : "",
    }))
    .sort((a, b) => b.stars - a.stars);
}

function isSafeGithubAvatar(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "avatars.githubusercontent.com" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
