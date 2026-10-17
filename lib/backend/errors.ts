export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function redactDiagnostic(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\b(?:sb_(?:secret|publishable)_[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/gi,
      "[REDACTED]",
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)?\b/g,
      "[REDACTED]",
    )
    .replace(
      /\b(?:access[_-]?token|refresh[_-]?token|provider[_-]?token|client[_-]?secret|service[_-]?role[_-]?key|authorization|cookie)\s*[:=]\s*["']?[^"'\s,;]+/gi,
      "[REDACTED]",
    )
    .slice(0, 500);
}

function errorDiagnostic(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: redactDiagnostic(error) ?? "Unknown error" };
  }
  const value = error as Record<string, unknown>;
  const diagnostic: Record<string, string> = {};
  for (const field of ["name", "code", "message", "details", "hint"]) {
    const safeValue = redactDiagnostic(value[field]);
    if (safeValue) diagnostic[field] = safeValue;
  }
  return Object.keys(diagnostic).length
    ? diagnostic
    : { message: "Unknown error" };
}

export function logServerError(context: string, error: unknown): void {
  console.error(context, JSON.stringify(errorDiagnostic(error)));
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    if (error.status >= 500) logServerError("API request failed", error);
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status },
    );
  }
  if (error && typeof error === "object" && "code" in error) {
    const codes: Record<string, [number, string, string]> = {
      "40001": [
        409,
        "STALE_DRAFT",
        "This draft changed elsewhere. Reload the latest saved version before continuing.",
      ],
      "55000": [
        409,
        "LISTING_LOCKED",
        "This listing is locked. Return a pending submission to draft before editing.",
      ],
      P0002: [404, "NOT_FOUND", "Application not found."],
      PGRST202: [
        503,
        "MIGRATION_REQUIRED",
        "The publishing database needs its latest migration. Ask the project administrator to apply it.",
      ],
      PGRST205: [
        503,
        "MIGRATION_REQUIRED",
        "The publishing database schema is not ready. Ask the project administrator to apply its migrations.",
      ],
    };
    const mapped = codes[String(error.code)];
    if (mapped)
      return Response.json(
        { error: { code: mapped[1], message: mapped[2] } },
        { status: mapped[0] },
      );
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  ) {
    return Response.json(
      {
        error: {
          code: "CONFLICT",
          message: "A record with these values already exists.",
        },
      },
      { status: 409 },
    );
  }
  logServerError("Unhandled API error", error);
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
      },
    },
    { status: 500 },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 64 * 1024)
    throw new ApiError("Request body is too large.", 413, "BODY_TOO_LARGE");
  if (!request.body)
    throw new ApiError("Request body must be valid JSON.", 400, "INVALID_JSON");
  try {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 64 * 1024) {
        await reader.cancel().catch(() => undefined);
        throw new ApiError("Request body is too large.", 413, "BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Request body must be valid JSON.", 400, "INVALID_JSON");
  }
}
