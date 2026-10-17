import "server-only";
import { z } from "zod";
import { ApiError } from "./errors";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export function getBackendEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new ApiError("Supabase is not configured.", 503, "SUPABASE_UNAVAILABLE");
  }
  return parsed.data;
}

export function getApplicationOrigin(): string {
  const parsed = z.string().url().safeParse(process.env.APP_URL);
  if (!parsed.success) {
    throw new ApiError("APP_URL is not configured for OAuth.", 503, "CONFIGURATION_ERROR");
  }
  const url = new URL(parsed.data);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new ApiError("APP_URL must contain only the canonical application origin.", 503, "CONFIGURATION_ERROR");
  }
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost" && url.protocol === "http:")) {
    throw new ApiError("APP_URL must use HTTPS outside local development.", 503, "CONFIGURATION_ERROR");
  }
  return url.origin;
}
