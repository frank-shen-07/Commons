import { persistDraft } from "@/lib/backend/publisher";
import { ApiError, errorResponse, readJson } from "@/lib/backend/errors";
import {
  applicationSummaryRelations,
  escapedSearch,
  matchingApplicationIds,
  publicApplication,
} from "@/lib/backend/marketplace";
import { createSupabaseServerClient } from "@/lib/backend/supabase";
import {
  listingSchema,
  browseQuerySchema,
  slugify,
} from "@/lib/backend/validation";
import type { ReleasePlatform } from "@/src/types/database.types";

export async function GET(request: Request) {
  try {
    const parsed = browseQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success)
      throw new ApiError(
        "Invalid browse parameters.",
        422,
        "VALIDATION_ERROR",
        parsed.error.issues,
      );
    const { q, category, platform, sort, page, limit } = parsed.data;
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("applications")
      .select("*", { count: "exact" })
      .eq("status", "published");
    const filters: string[][] = [];
    if (q) {
      const safeSearch = escapedSearch(q);
      if (!safeSearch)
        return Response.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      const [appsByText, matchingProfiles] = await Promise.all([
        supabase
          .from("applications")
          .select("id")
          .eq("status", "published")
          .or(
            `name.ilike.%${safeSearch}%,summary.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`,
          ),
        supabase
          .from("developer_profiles")
          .select("user_id")
          .or(
            `github_username.ilike.%${safeSearch}%,display_name.ilike.%${safeSearch}%`,
          ),
      ]);
      if (appsByText.error) throw appsByText.error;
      if (matchingProfiles.error) throw matchingProfiles.error;
      const profileIds = (matchingProfiles.data ?? []).map(
        (profile) => profile.user_id,
      );
      const appsByPublisher = profileIds.length
        ? await supabase
            .from("applications")
            .select("id")
            .eq("status", "published")
            .in("publisher_id", profileIds)
        : { data: [], error: null };
      if (appsByPublisher.error) throw appsByPublisher.error;
      filters.push([
        ...new Set([
          ...(appsByText.data ?? []).map((app) => app.id),
          ...(appsByPublisher.data ?? []).map((app) => app.id),
        ]),
      ]);
    }
    if (category) {
      const { data: categoryRow, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", slugify(category))
        .maybeSingle();
      if (categoryError) throw categoryError;
      if (!categoryRow)
        return Response.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      const { data: links, error: linksError } = await supabase
        .from("application_categories")
        .select("application_id")
        .eq("category_id", categoryRow.id);
      if (linksError) throw linksError;
      filters.push((links ?? []).map((link) => link.application_id));
    }
    if (platform) {
      const platformIds = await matchingApplicationIds(
        supabase,
        platform as ReleasePlatform,
      );
      if (platform === "web") {
        const { data: webApps, error: webError } = await supabase
          .from("applications")
          .select("id")
          .eq("status", "published")
          .not("web_url", "is", null);
        if (webError) throw webError;
        platformIds.push(...(webApps ?? []).map((app) => app.id));
      }
      filters.push([...new Set(platformIds)]);
    }
    if (filters.length) {
      const allowedIds = new Set(filters[0]);
      for (const filter of filters.slice(1)) {
        const included = new Set(filter);
        for (const id of allowedIds)
          if (!included.has(id)) allowedIds.delete(id);
      }
      if (!allowedIds.size)
        return Response.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      query = query.in("id", [...allowedIds]);
    }
    if (sort === "featured")
      query = query
        .order("featured", { ascending: false })
        .order("published_at", { ascending: false })
        .order("id");
    else if (sort === "updated")
      query = query.order("updated_at", { ascending: false }).order("id");
    else if (sort === "name") query = query.order("name").order("id");
    else query = query.order("published_at", { ascending: false }).order("id");
    const from = (page - 1) * limit;
    const {
      data: apps,
      count,
      error,
    } = await query.range(from, from + limit - 1);
    if (error) throw error;
    const relations = await applicationSummaryRelations(supabase, apps ?? []);
    return Response.json(
      {
        data: (apps ?? []).map((app) =>
          publicApplication(app, relations.get(app.id)),
        ),
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.ceil((count ?? 0) / limit),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = listingSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(
        "Listing data is invalid.",
        422,
        "VALIDATION_ERROR",
        parsed.error.issues,
      );
    return Response.json(
      { data: await persistDraft(parsed.data, null, 0) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
