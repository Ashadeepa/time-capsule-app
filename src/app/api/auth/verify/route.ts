import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const email = token ? await consumeMagicLink(token) : null;

  if (!email) {
    return NextResponse.redirect(new URL("/my-letters?error=invalid-link", req.url));
  }

  const sessionToken = await createSessionToken(email);
  const res = NextResponse.redirect(new URL("/my-letters", req.url));
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
