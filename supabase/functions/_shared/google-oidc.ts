/**
 * Google OIDC verification for Pub/Sub Push Subscriptions.
 *
 * Verifies the `Authorization: Bearer <jwt>` header that Google Pub/Sub
 * attaches to push messages when "Authentication" is enabled with an
 * OIDC token. Validates: RS256 signature against Google's JWKs,
 * issuer, audience, signer email and expiration.
 *
 * Returns the parsed claims on success, or throws an Error whose message
 * starts with "OIDC_" indicating the specific failure reason. Callers
 * MUST translate any thrown error into HTTP 401 (unauthorized).
 *
 * Docs: https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions
 */

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ALLOWED_ISSUERS = new Set([
  'https://accounts.google.com',
  'accounts.google.com',
]);

interface JwkKey {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

interface JwksCache {
  keys: Record<string, CryptoKey>;
  expiresAt: number;
}

let jwksCache: JwksCache | null = null;

function base64UrlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64UrlDecodeToString(input: string): string {
  return new TextDecoder().decode(base64UrlDecode(input));
}

async function importGoogleJwk(jwk: JwkKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: 'RS256',
      ext: true,
    } as JsonWebKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

async function loadJwks(): Promise<Record<string, CryptoKey>> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error('OIDC_JWKS_FETCH_FAILED');
  }

  // Respect Cache-Control max-age (default 1h fallback)
  const cc = res.headers.get('cache-control') || '';
  const m = cc.match(/max-age=(\d+)/);
  const maxAge = m ? parseInt(m[1], 10) : 3600;

  const body = await res.json();
  const out: Record<string, CryptoKey> = {};
  for (const k of (body.keys || []) as JwkKey[]) {
    out[k.kid] = await importGoogleJwk(k);
  }
  jwksCache = { keys: out, expiresAt: now + maxAge * 1000 };
  return out;
}

export interface OidcClaims {
  iss: string;
  aud: string;
  email?: string;
  email_verified?: boolean;
  exp: number;
  iat?: number;
  sub?: string;
}

export interface VerifyOptions {
  expectedAudience: string;
  expectedEmail: string;
  clockSkewSeconds?: number;
}

/**
 * Extracts and verifies the Bearer JWT from the request.
 * Throws Error('OIDC_*') on any failure.
 */
export async function verifyGoogleOidc(
  req: Request,
  opts: VerifyOptions
): Promise<OidcClaims> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('OIDC_MISSING_BEARER');
  }
  const jwt = authHeader.slice('Bearer '.length).trim();
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('OIDC_MALFORMED_JWT');
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string; typ?: string };
  let payload: OidcClaims;
  try {
    header = JSON.parse(base64UrlDecodeToString(headerB64));
    payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch {
    throw new Error('OIDC_BAD_JSON');
  }

  if (header.alg !== 'RS256') throw new Error('OIDC_BAD_ALG');
  if (!header.kid) throw new Error('OIDC_NO_KID');

  const keys = await loadJwks();
  const key = keys[header.kid];
  if (!key) {
    // refresh once in case Google rotated keys recently
    jwksCache = null;
    const refreshed = await loadJwks();
    if (!refreshed[header.kid]) throw new Error('OIDC_UNKNOWN_KID');
    return await verifyAndCheckClaims(jwt, refreshed[header.kid], payload, headerB64, payloadB64, signatureB64, opts);
  }

  return await verifyAndCheckClaims(jwt, key, payload, headerB64, payloadB64, signatureB64, opts);
}

async function verifyAndCheckClaims(
  _jwt: string,
  key: CryptoKey,
  payload: OidcClaims,
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
  opts: VerifyOptions
): Promise<OidcClaims> {
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  if (!ok) throw new Error('OIDC_BAD_SIGNATURE');

  const skew = opts.clockSkewSeconds ?? 60;
  const now = Math.floor(Date.now() / 1000);

  if (!ALLOWED_ISSUERS.has(payload.iss)) throw new Error('OIDC_BAD_ISSUER');
  if (payload.aud !== opts.expectedAudience) throw new Error('OIDC_BAD_AUDIENCE');
  if (!payload.email || payload.email !== opts.expectedEmail) throw new Error('OIDC_BAD_EMAIL');
  if (payload.email_verified !== true) throw new Error('OIDC_EMAIL_NOT_VERIFIED');
  if (typeof payload.exp !== 'number' || payload.exp + skew < now) throw new Error('OIDC_EXPIRED');

  return payload;
}
