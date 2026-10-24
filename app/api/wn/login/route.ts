import { NextResponse } from "next/server";
import {
  verifyWnCredentials,
  createWnToken,
  WN_COOKIE,
} from "@/lib/auth";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = body.username ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  if (!verifyWnCredentials(username, password)) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  const token = await createWnToken(username.trim());
  const response = NextResponse.json({ ok: true });
  // No maxAge on the cookie: it dies with the browser session, and the token
  // itself expires after 2 hours, so the lock comes back often.
  response.cookies.set(WN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  return response;
}
