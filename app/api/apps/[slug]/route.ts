import { getAuthenticatedUser } from "@/lib/backend/auth";
import { ApiError, errorResponse, readJson } from "@/lib/backend/errors";
import { applicationRelations, publicApplication } from "@/lib/backend/marketplace";
import { apiUuidSchema, normalizeScreenshots, slugify, updateListingSchema } from "@/lib/backend/validation";
import { createSupabaseServerClient } from "@/lib/backend/supabase";
import { createSupabaseAdminClient } from "@/lib/backend/supabase-admin";
import type { Database } from "@/src/types/database.types";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: app, error } = await supabase.from("applications").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
    if (error) throw error;
    if (!app) throw new ApiError("Application not found.", 404, "NOT_FOUND");
    const relations = await applicationRelations(supabase, [app]);
    const { data: categories, error: categoryError } = await supabase.from("application_categories").select("category_id").eq("application_id", app.id);
    if (categoryError) throw categoryError;
    const categoryIds = (categories ?? []).map((item) => item.category_id);
    const categoryData = categoryIds.length
      ? await supabase.from("categories").select("id, name, slug").in("id", categoryIds)
      : { data: [], error: null };
    if (categoryData.error) throw categoryData.error;
    const data = publicApplication(app, {
      ...relations.get(app.id),
      description: app.description,
      categories: categoryData.data ?? [],
      category: categoryData.data?.[0]?.name ?? null,
    });
    return Response.json({ data }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { slug: id } = await params;
    if (!apiUuidSchema.safeParse(id).success) throw new ApiError("Invalid application ID.", 400, "INVALID_ID");
    const parsed = updateListingSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError("Listing update is invalid.", 422, "VALIDATION_ERROR", parsed.error.issues);
    const { supabase, user } = await getAuthenticatedUser();
    const { data: current, error: currentError } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
    if (currentError) throw currentError;
    if (!current || current.publisher_id !== user.id) throw new ApiError("Application not found.", 404, "NOT_FOUND");
    if (current.status !== "draft" && current.status !== "pending_review") {
      throw new ApiError("Published or moderated listings cannot be edited through this endpoint.", 409, "LISTING_LOCKED");
    }
    if (current.status === "pending_review") {
      const admin = createSupabaseAdminClient();
      const { error: resetError } = await admin.from("applications").update({ status: "draft" }).eq("id", id).eq("publisher_id", user.id);
      if (resetError) throw resetError;
    }
    const input = parsed.data;
    const update: Database["public"]["Tables"]["applications"]["Update"] = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.summary !== undefined) update.summary = input.summary;
    if (input.description !== undefined) update.description = input.description;
    if (input.iconUrl !== undefined) update.icon_url = input.iconUrl || null;
    if (input.websiteUrl !== undefined) update.website_url = input.websiteUrl || null;
    if (input.webUrl !== undefined) update.web_url = input.webUrl || null;
    if (input.category !== undefined) {
      const { data: category, error: categoryError } = await supabase.from("categories").select("id").eq("slug", slugify(input.category)).maybeSingle();
      if (categoryError) throw categoryError;
      if (!category) throw new ApiError("Choose a supported marketplace category.", 422, "INVALID_CATEGORY");
      const { error: deleteError } = await supabase.from("application_categories").delete().eq("application_id", id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from("application_categories").insert({ application_id: id, category_id: category.id });
      if (insertError) throw insertError;
    }
    if (Object.keys(update).length) {
      const { error: updateError } = await supabase.from("applications").update(update).eq("id", id);
      if (updateError) throw updateError;
    }
    if (input.screenshots !== undefined) {
      const { error: deleteError } = await supabase.from("application_screenshots").delete().eq("application_id", id);
      if (deleteError) throw deleteError;
      const screenshots = normalizeScreenshots(input.screenshots);
      if (screenshots.length) {
        const { error: insertError } = await supabase.from("application_screenshots").insert(screenshots.map(({ imageUrl: image_url, altText: alt_text }, display_order) => ({
          application_id: id,
          image_url,
          alt_text,
          display_order,
        })));
        if (insertError) throw insertError;
      }
    }
    const { data: updated, error: updatedError } = await supabase.from("applications").select("*").eq("id", id).single();
    if (updatedError) throw updatedError;
    return Response.json({
      data: {
        id: updated.id,
        slug: updated.slug,
        status: updated.status,
        name: updated.name,
        summary: updated.summary,
        description: updated.description,
        iconUrl: updated.icon_url,
        repositoryUrl: updated.repository_url,
        websiteUrl: updated.website_url,
        webUrl: updated.web_url,
        updatedAt: updated.updated_at,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
