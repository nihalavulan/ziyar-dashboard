import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "ziyar_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Add it to .env.local");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  email: string;
}

/** Create a signed session token for the given user. */
export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecretKey());
}

/** Verify a session token; returns the payload or null if invalid. */
export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return { email: payload.email as string };
  } catch {
    return null;
  }
}

/** Constant-time-ish comparison of admin credentials against env values. */
export function verifyCredentials(email: string, password: string) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  return (
    email.trim().toLowerCase() === adminEmail.trim().toLowerCase() &&
    password === adminPassword
  );
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE;

// ---------------------------------------------------------------------------
// Hidden "/wn" dashboard — a second, separate lock on top of the main login.
// ---------------------------------------------------------------------------

const WN_COOKIE_NAME = "ziyar_wn";
const WN_MAX_AGE = 60 * 60 * 2; // 2 hours

/** Create a signed token that unlocks the hidden /wn dashboard. */
export async function createWnToken(username: string) {
  return new SignJWT({ username, scope: "wn" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${WN_MAX_AGE}s`)
    .sign(getSecretKey());
}

/** Verify a /wn token; a normal session token is rejected (scope check). */
export async function verifyWnToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.scope !== "wn") return null;
    return { username: payload.username as string };
  } catch {
    return null;
  }
}

/** Check /wn credentials against env values. */
export function verifyWnCredentials(username: string, password: string) {
  const wnUsername = process.env.WN_USERNAME ?? "";
  const wnPassword = process.env.WN_PASSWORD ?? "";
  if (!wnUsername || !wnPassword) return false;
  return (
    username.trim().toLowerCase() === wnUsername.trim().toLowerCase() &&
    password === wnPassword
  );
}

export const WN_COOKIE = WN_COOKIE_NAME;
export const WN_MAX_AGE_SECONDS = WN_MAX_AGE;
