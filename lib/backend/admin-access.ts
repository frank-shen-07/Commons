import { z } from "zod";
import { ApiError, errorResponse } from "./errors.ts";

export function assertAdmin(userId: string, allowlist: string | undefined) {
  const ids = (allowlist ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => z.string().uuid().safeParse(id).success);
  if (!ids.includes(userId))
    throw new ApiError(
      "This account does not have administrator access.",
      403,
      "ADMIN_REQUIRED",
    );
}

export const adminApprovalSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();

export function adminErrorResponse(error: unknown): Response {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    ["40001", "55000"].includes(String(error.code))
  ) {
    return Response.json(
      {
        error: {
          code: "STALE_SUBMISSION",
          message:
            "This submission changed or is no longer awaiting review. Reload and review it again.",
        },
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  return privateError(error);
}

function privateError(error: unknown) {
  const response = errorResponse(error);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
