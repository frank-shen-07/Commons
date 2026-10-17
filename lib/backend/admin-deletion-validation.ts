import { z } from "zod";
import { ApiError } from "./errors.ts";
import { adminErrorResponse } from "./admin-access.ts";

export const applicationLookupSchema = z
  .object({ url: z.string().trim().url().max(2048) })
  .strict();
export const applicationDeletionSchema = z
  .object({
    confirmSlug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export function applicationSlugFromUrl(value: string, origin: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(
      "Enter a valid application URL from this site.",
      422,
      "VALIDATION_ERROR",
    );
  }
  const match = url.pathname.match(/^\/apps\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (
    url.origin !== new URL(origin).origin ||
    url.username ||
    url.password ||
    value.includes("?") ||
    value.includes("#") ||
    !match
  ) {
    throw new ApiError(
      "Use an application URL from this site with the path /apps/application-slug and no query or fragment.",
      422,
      "VALIDATION_ERROR",
    );
  }
  return match[1];
}

export function deletionErrorResponse(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    String(error.code) === "40001"
  ) {
    return adminErrorResponse(
      new ApiError(
        "This application changed. Find it again and check the latest listing before deleting.",
        409,
        "STALE_APPLICATION",
      ),
    );
  }
  return adminErrorResponse(error);
}
