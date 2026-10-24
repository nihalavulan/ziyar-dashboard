import { NextResponse } from "next/server";
import { SESSION_COOKIE, WN_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  // Signing out of the main dashboard also re-locks the hidden /wn area.
  response.cookies.set(WN_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
