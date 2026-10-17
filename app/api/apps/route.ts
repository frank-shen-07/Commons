import { getAuthenticatedUser, getGithubProviderToken, githubUsername } from "@/lib/backend/auth";
import { ApiError, errorResponse, readJson } from "@/lib/backend/errors";
import { verifyGithubRepository } from "@/lib/backend/github";
import { applicationSummaryRelations, escapedSearch, matchingApplicationIds, publicApplication } from "@/lib/backend/marketplace";
import { createSupabaseServerClient } from "@/lib/backend/supabase";
import { createSupabaseAdminClient } from "@/lib/backend/supabase-admin";
import { listingSchema, browseQuerySchema, normalizeScreenshots, safeExternalHttps, slugify } from "@/lib/backend/validation";
import { saveVerifiedReleaseData } from "@/lib/backend/release-storage";
import type { ReleasePlatform } from "@/src/types/database.types";

export async function GET(request: Request) {
  try {
    const parsed = browseQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new ApiError("Invalid browse parameters.", 422, "VALIDATION_ERROR", parsed.error.issues);
    const { q, category, platform, sort, page, limit } = parsed.data;
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("applications").select("*", { count: "exact" }).eq("status", "published");
    const filters: string[][] = [];
    if (q) {
      const safeSearch = escapedSearch(q);
      if (!safeSearch) return Response.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      const [appsByText, matchingProfiles] = await Promise.all([
        supabase.from("applications").select("id").eq("status", "published")
          .or(`name.ilike.%${safeSearch}%,summary.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`),
        supabase.from("developer_profiles").select("user_id")
          .or(`github_username.ilike.%${safeSearch}%,display_name.ilike.%${safeSearch}%`),
      ]);
      if (appsByText.error) throw appsByText.error;
      if (matchingProfiles.error) throw matchingProfiles.error;
      const profileIds = (matchingProfiles.data ?? []).map((profile) => profile.user_id);
      const appsByPublisher = profileIds.length
        ? await supabase.from("applications").select("id").eq("status", "published").in("publisher_id", profileIds)
        : { data: [], error: null };
      if (appsByPublisher.error) throw appsByPublisher.error;
      filters.push([...new Set([
        ...(appsByText.data ?? []).map((app) => app.id),
        ...(appsByPublisher.data ?? []).map((app) => app.id),
      ])]);
    }
    if (category) {
      const { data: categoryRow, error: categoryError } = await supabase.from("categories").select("id").eq("slug", slugify(category)).maybeSingle();
      if (categoryError) throw categoryError;
      if (!categoryRow) return Response.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      const { data: links, error: linksError } = await supabase.from("application_categories").select("application_id").eq("category_id", categoryRow.id);
      if (linksError) throw linksError;
      filters.push((links ?? []).map((link) => link.application_id));
    }
    if (platform) {
      const platformIds = await matchingApplicationIds(supabase, platform as ReleasePlatform);
      if (platform === "web") {
        const { data: webApps, error: webError } = await supabase.from("applications").select("id").eq("status", "published").not("web_url", "is", null);
        if (webError) throw webError;
        platformIds.push(...(webApps ?? []).map((app) => app.id));
      }
      filters.push([...new Set(platformIds)]);
    }
    if (filters.length) {
      const allowedIds = new Set(filters[0]);
      for (const filter of filters.slice(1)) {
        const included = new Set(filter);
        for (const id of allowedIds) if (!included.has(id)) allowedIds.delete(id);
      }
      if (!allowedIds.size) return Response.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      query = query.in("id", [...allowedIds]);
    }
    if (sort === "featured") query = query.order("featured", { ascending: false }).order("published_at", { ascending: false }).order("id");
    else if (sort === "updated") query = query.order("updated_at", { ascending: false }).order("id");
    else if (sort === "name") query = query.order("name").order("id");
    else query = query.order("published_at", { ascending: false }).order("id");
    const from = (page - 1) * limit;
    const { data: apps, count, error } = await query.range(from, from + limit - 1);
    if (error) throw error;
    const relations = await applicationSummaryRelations(supabase, apps ?? []);
    return Response.json({
      data: (apps ?? []).map((app) => publicApplication(app, relations.get(app.id))),
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let createdAppId: string | null = null;
  try {
    const parsed = listingSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError("Listing data is invalid.", 422, "VALIDATION_ERROR", parsed.error.issues);
    const input = parsed.data;
    const { supabase, user } = await getAuthenticatedUser();
    const token = await getGithubProviderToken(supabase, user);
    const username = githubUsername(user);
    if (!username) throw new ApiError("Your GitHub username could not be verified. Reconnect GitHub.", 403, "GITHUB_IDENTITY_MISSING");
    const { repository, releases } = await verifyGithubRepository(input.repository, token);
    const admin = createSupabaseAdminClient();
    const { data: duplicate, error: duplicateError } = await admin.from("applications").select("id").eq("github_repository_id", repository.id).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) throw new ApiError("This repository already has a marketplace listing.", 409, "REPOSITORY_ALREADY_LISTED");
    const { data: existingProfile, error: existingProfileError } = await admin.from("developer_profiles").select("display_name, avatar_url, biography").eq("user_id", user.id).maybeSingle();
    if (existingProfileError) throw existingProfileError;
    const { data: profile, error: profileError } = await admin.from("developer_profiles").upsert({
      user_id: user.id,
      github_username: username,
      display_name: existingProfile?.display_name || (typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : username),
      avatar_url: existingProfile?.avatar_url ?? safeExternalHttps(typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : repository.owner.avatar_url),
      biography: existingProfile?.biography ?? null,
    }, { onConflict: "user_id" }).select("user_id").single();
    if (profileError) throw profileError;
    const { data: category, error: categoryError } = await supabase.from("categories").select("id, name").eq("slug", slugify(input.category)).maybeSingle();
    if (categoryError) throw categoryError;
    if (!category) throw new ApiError("Choose a supported marketplace category.", 422, "INVALID_CATEGORY");
    const baseSlug = slugify(input.name);
    let slug = baseSlug;
    for (let suffix = 2; ; suffix += 1) {
      const { data: existingSlug, error: slugError } = await admin.from("applications").select("id").eq("slug", slug).maybeSingle();
      if (slugError) throw slugError;
      if (!existingSlug) break;
      slug = slugify(`${baseSlug}-${suffix}`);
    }
    const { data: app, error: appError } = await admin.from("applications").insert({
      publisher_id: profile.user_id,
      name: input.name,
      slug,
      summary: input.summary,
      description: input.description,
      icon_url: input.iconUrl || safeExternalHttps(repository.owner.avatar_url),
      repository_url: repository.html_url,
      repository_owner: repository.owner.login,
      repository_name: repository.name,
      github_repository_id: repository.id,
      license: repository.license?.spdx_id === "NOASSERTION" ? null : repository.license?.spdx_id ?? null,
      website_url: input.websiteUrl || safeExternalHttps(repository.homepage),
      web_url: input.webUrl || null,
      status: "draft",
    }).select("*").single();
    if (appError) throw appError;
    createdAppId = app.id;
    const { error: categoryLinkError } = await supabase.from("application_categories").insert({ application_id: app.id, category_id: category.id });
    if (categoryLinkError) throw categoryLinkError;
    const screenshots = normalizeScreenshots(input.screenshots);
    if (screenshots.length) {
      const { error: screenshotError } = await supabase.from("application_screenshots").insert(screenshots.map(({ imageUrl: image_url, altText: alt_text }, display_order) => ({
        application_id: app.id,
        image_url,
        alt_text,
        display_order,
      })));
      if (screenshotError) throw screenshotError;
    }
    await saveVerifiedReleaseData(supabase, app.id, `${repository.owner.login}/${repository.name}`, releases, input.releaseId, input.assets);
    return Response.json({
      data: {
        id: app.id,
        slug: app.slug,
        status: app.status,
        name: app.name,
        summary: app.summary,
        description: app.description,
        iconUrl: app.icon_url,
        repositoryUrl: app.repository_url,
        websiteUrl: app.website_url,
        webUrl: app.web_url,
        license: app.license,
        category: category.name,
        screenshots: screenshots.map(({ imageUrl, altText }) => ({ url: imageUrl, alt: altText })),
        createdAt: app.created_at,
        updatedAt: app.updated_at,
      },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (createdAppId) {
      try {
        const { supabase } = await getAuthenticatedUser();
        await supabase.from("applications").delete().eq("id", createdAppId);
      } catch {
        console.error("Could not remove incomplete draft after failed creation.");
      }
    }
    return errorResponse(error);
  }
}
