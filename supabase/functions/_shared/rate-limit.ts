// Shared rate limiting helper for Edge Functions.
// Uses the public.check_rate_limit RPC (SECURITY DEFINER) via service_role.
// Never expose IPs in clear text — only sha256-hashed prefixes.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let cachedAdmin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (!cachedAdmin) {
    cachedAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedAdmin;
}

export interface RateLimitConfig {
  /** Logical name of the function. Used in the bucket key. */
  functionName: string;
  /** Max requests inside the window. */
  maxRequests: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /**
   * If true, when the RPC itself fails the request is allowed (fail-open).
   * If false, the request is denied (fail-closed). Default: true.
   */
  failOpen?: boolean;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
  windowSeconds: number;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build a stable bucket identifier. Prefers user_id; falls back to a
 * sha256 hash of the IP (never the raw IP). If neither is available,
 * returns null and the caller may decide to allow or deny.
 */
export async function buildBucketKey(opts: {
  functionName: string;
  userId?: string | null;
  ip?: string | null;
  extra?: string;
}): Promise<string | null> {
  const { functionName, userId, ip, extra } = opts;
  const suffix = extra ? `:${extra}` : "";
  if (userId) return `${functionName}:u:${userId}${suffix}`;
  if (ip) {
    const h = await sha256Hex(`rl:${ip}`);
    return `${functionName}:iphash:${h.slice(0, 32)}${suffix}`;
  }
  return null;
}

/**
 * Check whether a request is allowed under the configured limit.
 * Uses pg_advisory_xact_lock inside the RPC to be concurrency-safe.
 */
export async function checkRateLimit(
  bucketKey: string,
  config: RateLimitConfig,
): Promise<RateLimitDecision> {
  const failOpen = config.failOpen !== false;
  try {
    const admin = getAdmin();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_bucket_key: bucketKey,
      p_max_requests: config.maxRequests,
      p_window_seconds: config.windowSeconds,
    });
    if (error || !data) {
      // Log without leaking secrets/headers.
      console.warn(
        `[rate-limit] RPC error in ${config.functionName}: ${error?.message ?? "no data"}; failOpen=${failOpen}`,
      );
      return {
        allowed: failOpen,
        remaining: failOpen ? config.maxRequests - 1 : 0,
        retryAfterSeconds: failOpen ? 0 : config.windowSeconds,
        limit: config.maxRequests,
        windowSeconds: config.windowSeconds,
      };
    }
    const d = data as Record<string, unknown>;
    return {
      allowed: Boolean(d.allowed),
      remaining: Number(d.remaining ?? 0),
      retryAfterSeconds: Number(d.retry_after_seconds ?? 0),
      limit: Number(d.limit ?? config.maxRequests),
      windowSeconds: Number(d.window_seconds ?? config.windowSeconds),
    };
  } catch (e) {
    console.warn(
      `[rate-limit] exception in ${config.functionName}: ${(e as Error).message}; failOpen=${failOpen}`,
    );
    return {
      allowed: failOpen,
      remaining: failOpen ? config.maxRequests - 1 : 0,
      retryAfterSeconds: failOpen ? 0 : config.windowSeconds,
      limit: config.maxRequests,
      windowSeconds: config.windowSeconds,
    };
  }
}

/** Build a 429 Response with standard headers. */
export function rateLimitResponse(
  decision: RateLimitDecision,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Too many requests. Please try again later.",
      retry_after_seconds: decision.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(decision.retryAfterSeconds || 1),
        "X-RateLimit-Limit": String(decision.limit),
        "X-RateLimit-Remaining": String(decision.remaining),
      },
    },
  );
}

/**
 * Constant-time string comparison. Returns false on length mismatch.
 * Use to compare INTERNAL_API_SECRET to header values.
 */
export function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

/**
 * Extract a best-effort client IP from common proxy headers.
 * Never log the raw value — always pass to buildBucketKey, which hashes it.
 */
export function extractClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return null;
}
