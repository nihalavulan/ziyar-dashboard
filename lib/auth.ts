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
