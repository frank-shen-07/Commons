import { ApiError } from "./errors.ts";

interface OAuthIdentity {
  provider: string;
}

interface OAuthUser {
  identities?: OAuthIdentity[] | null;
}

export function requireAuthenticatedUser<T extends OAuthUser>(user: T | null, error: unknown): T {
  if (error || !user) throw new ApiError("Sign in to continue.", 401, "UNAUTHENTICATED");
  return user;
}

export function requireGithubProviderToken(
  session: { provider_token?: string | null } | null,
  user: OAuthUser,
): string {
  const token = session?.provider_token;
  if (!token || !user.identities?.some((identity) => identity.provider === "github")) {
    throw new ApiError(
      "A GitHub OAuth session with repository access is required. Sign out and connect GitHub again.",
      403,
      "GITHUB_TOKEN_UNAVAILABLE",
    );
  }
  return token;
}

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export async function resolveOAuthCallback(input: {
  code: string | null;
  next: string | null;
  origin: string;
  exchangeCodeForSession: (code: string) => Promise<{ error: unknown | null }>;
}): Promise<string> {
  const failureUrl = new URL("/?auth=failed", input.origin).toString();
  if (!input.code) return failureUrl;
  try {
    const { error } = await input.exchangeCodeForSession(input.code);
    return error ? failureUrl : new URL(safeNext(input.next), input.origin).toString();
  } catch {
    return failureUrl;
  }
}
