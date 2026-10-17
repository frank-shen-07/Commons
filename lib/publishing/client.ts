"use client";
import type { PublishingRequest, ApiErrorResponse } from "@/src/types/api";
import type { ListingInput } from "./types";
export class PublishingApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function publisherRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(45000),
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const body = await response.json();
  if (!response.ok) {
    const error = (body as ApiErrorResponse).error;
    throw new PublishingApiError(
      error?.message ?? "The request failed. Please try again.",
      error?.code ?? "REQUEST_FAILED",
      response.status,
      error?.details,
    );
  }
  return body.data as T;
}
export function portalInput(input: PublishingRequest): ListingInput {
  return {
    ...input,
    iconUrl: input.iconUrl ?? "",
    websiteUrl: input.websiteUrl ?? "",
    webUrl: input.webUrl ?? "",
    screenshots: (input.screenshots ?? []).map((s) =>
      typeof s === "string" ? s : s.url,
    ),
    releaseId: input.releaseId ?? null,
    assets: (input.assets ?? []) as ListingInput["assets"],
  };
}
export function errorMessage(error: unknown): string {
  if (error instanceof PublishingApiError && Array.isArray(error.details)) {
    const details = error.details as Array<{
      path?: unknown[];
      message?: string;
    }>;
    return `${error.message} ${details.map((d) => `${d.path?.join(".") ?? "Field"}: ${d.message ?? "Check this value."}`).join(" ")}`;
  }
  return error instanceof Error
    ? error.message
    : "Could not complete the request. Please try again.";
}
export function statusLabel(status: string | null) {
  return (
    (
      {
        draft: "Draft",
        pending_review: "In review",
        approved: "Approved",
        published: "Published",
        rejected: "Changes requested",
        suspended: "Suspended",
      } as Record<string, string>
    )[status ?? ""] ?? "Draft"
  );
}
