import { developerListing, persistDraft } from "@/lib/backend/publisher";
import { updateListingSchema } from "@/lib/backend/validation";
import { ApiError, errorResponse, readJson } from "@/lib/backend/errors";
import {
  applicationRelations,
  publicApplication,
} from "@/lib/backend/marketplace";
import { createSupabaseServerClient } from "@/lib/backend/supabase";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: app, error } = await supabase
      .from("applications")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    if (!app) throw new ApiError("Application not found.", 404, "NOT_FOUND");
    const relations = await applicationRelations(supabase, [app]);
    const { data: categories, error: categoryError } = await supabase
      .from("application_categories")
      .select("category_id")
      .eq("application_id", app.id);
    if (categoryError) throw categoryError;
    const categoryIds = (categories ?? []).map((item) => item.category_id);
    const categoryData = categoryIds.length
      ? await supabase
          .from("categories")
          .select("id, name, slug")
          .in("id", categoryIds)
      : { data: [], error: null };
    if (categoryData.error) throw categoryData.error;
    const data = publicApplication(app, {
      ...relations.get(app.id),
      description: app.description,
      categories: categoryData.data ?? [],
      category: categoryData.data?.[0]?.name ?? null,
    });
    return Response.json(
      { data },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const parsed = updateListingSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(
        "Listing update is invalid.",
        422,
        "VALIDATION_ERROR",
        parsed.error.issues,
      );
    const id = (await params).slug;
    const current = await developerListing(id);
    if (current.revisionStatus === "pending_review")
      throw new ApiError(
        "Return this submission to draft before editing.",
        409,
        "LISTING_LOCKED",
      );
    return Response.json(
      {
        data: await persistDraft(
          { ...current.snapshot.input, ...parsed.data },
          id,
          current.version,
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
