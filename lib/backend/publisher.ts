import "server-only";
import { z } from "zod";
import {
  getAuthenticatedUser,
  getGithubProviderToken,
  githubUsername,
} from "./auth";
import { createSupabaseAdminClient } from "./supabase-admin";
import { verifyGithubRepository } from "./github";
import { ApiError } from "./errors";
import {
  listingSchema,
  safeExternalHttps,
  slugify,
  apiUuidSchema,
} from "./validation";
import { verifiedRepository, validateSelection } from "./publishing-snapshot";
import type {
  DeveloperListing,
  PublisherSnapshot,
  PublishingRequest,
} from "@/src/types/api";
import type { Json } from "@/src/types/database.types";

export const saveDraftSchema = z
  .object({
    input: listingSchema,
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();
export const versionSchema = z
  .object({ expectedVersion: z.number().int().nonnegative() })
  .strict();

export async function ownedApplication(id: string) {
  if (!apiUuidSchema.safeParse(id).success)
    throw new ApiError("Application not found.", 404, "NOT_FOUND");
  const auth = await getAuthenticatedUser();
  const { data: app, error } = await auth.supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .eq("publisher_id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!app) throw new ApiError("Application not found.", 404, "NOT_FOUND");
  return { ...auth, app };
}

export async function developerListing(id: string): Promise<DeveloperListing> {
  const { supabase, app } = await ownedApplication(id);
  const { data: revision, error } = await supabase
    .from("application_revisions")
    .select("*")
    .eq("application_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  let snapshot: PublisherSnapshot;
  if (revision) snapshot = revision.snapshot as unknown as PublisherSnapshot;
  else {
    // Legacy records have no recoverable selection. Require explicit reconfirmation on the next submission.
    const [links, shots] = await Promise.all([
      supabase
        .from("application_categories")
        .select("category_id")
        .eq("application_id", id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("application_screenshots")
        .select("image_url, alt_text")
        .eq("application_id", id)
        .order("display_order"),
    ]);
    if (links.error) throw links.error;
    if (shots.error) throw shots.error;
    const category = links.data
      ? await supabase
          .from("categories")
          .select("id, name")
          .eq("id", links.data.category_id)
          .single()
      : null;
    if (category?.error) throw category.error;
    snapshot = {
      input: {
        repository: `${app.repository_owner}/${app.repository_name}`,
        name: app.name,
        summary: app.summary,
        description: app.description,
        category: category?.data?.name ?? "Utilities",
        screenshots: shots.data.map((s) => ({
          url: s.image_url,
          alt: s.alt_text,
        })),
        iconUrl: app.icon_url ?? "",
        websiteUrl: app.website_url ?? "",
        webUrl: app.web_url ?? "",
        releaseId: null,
        assets: [],
      },
      categoryId: category?.data?.id ?? "",
      repository: {
        id: app.github_repository_id,
        fullName: `${app.repository_owner}/${app.repository_name}`,
        name: app.repository_name,
        description: "",
        url: app.repository_url,
        websiteUrl: app.website_url ?? "",
        owner: app.repository_owner,
        avatarUrl: "",
        license: app.license,
        readme: "",
        releases: [],
      },
    };
  }
  return {
    ...snapshot.input,
    createdAt: app.created_at,
    repositoryUrl: app.repository_url,
    license: snapshot.repository.license,
    id: app.id,
    slug: app.slug,
    name: snapshot.input.name,
    repository: snapshot.input.repository,
    status: app.status,
    revisionStatus: revision?.status ?? null,
    version: revision?.version ?? 0,
    revisionId: revision?.id ?? null,
    updatedAt: revision?.updated_at ?? app.updated_at,
    snapshot,
  };
}

async function snapshotFor(input: PublishingRequest, submitting: boolean) {
  const { supabase, user } = await getAuthenticatedUser();
  const token = await getGithubProviderToken(supabase, user);
  const verified = await verifyGithubRepository(input.repository, token);
  const repository = verifiedRepository(verified.repository, verified.releases);
  validateSelection(input, repository, submitting);
  const { data: category, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("slug", slugify(input.category))
    .maybeSingle();
  if (error) throw error;
  if (!category)
    throw new ApiError("Choose a supported category.", 422, "INVALID_CATEGORY");
  return {
    user,
    snapshot: {
      input: {
        ...input,
        repository: repository.fullName,
        category: category.name,
      },
      repository,
      categoryId: category.id,
    } satisfies PublisherSnapshot,
  };
}

export async function persistDraft(
  input: PublishingRequest,
  id: string | null,
  expectedVersion: number,
) {
  if (id) await ownedApplication(id);
  const { user, snapshot } = await snapshotFor(input, false);
  const admin = createSupabaseAdminClient();
  if (!id) {
    const username = githubUsername(user);
    if (!username)
      throw new ApiError(
        "Reconnect your GitHub account.",
        403,
        "GITHUB_IDENTITY_MISSING",
      );
    const { error } = await admin.from("developer_profiles").upsert(
      {
        user_id: user.id,
        github_username: username,
        display_name:
          typeof user.user_metadata.full_name === "string"
            ? user.user_metadata.full_name
            : username,
        avatar_url: safeExternalHttps(user.user_metadata.avatar_url),
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    if (error) throw error;
  }
  const { data, error } = await admin.rpc("publisher_save_draft", {
    p_owner: user.id,
    p_application_id: id,
    p_expected_version: expectedVersion,
    p_snapshot: snapshot as unknown as Json,
  });
  if (error) throw error;
  return developerListing(data);
}

export async function submitDraft(id: string, expectedVersion?: number) {
  const listing = await developerListing(id);
  if (expectedVersion !== undefined && expectedVersion !== listing.version)
    throw new ApiError(
      "This draft changed. Reload before submitting.",
      409,
      "STALE_DRAFT",
    );
  const parsed = listingSchema.safeParse(listing.snapshot.input);
  if (!parsed.success)
    throw new ApiError(
      "Complete your listing before submitting.",
      422,
      "VALIDATION_ERROR",
      parsed.error.issues,
    );
  const { user, snapshot } = await snapshotFor(parsed.data, true);
  const { error } = await createSupabaseAdminClient().rpc(
    "publisher_submit_revision",
    {
      p_owner: user.id,
      p_application_id: id,
      p_expected_version: listing.version,
      p_snapshot: snapshot as unknown as Json,
    },
  );
  if (error) throw error;
  return developerListing(id);
}
