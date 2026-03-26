import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Protect admin routes with INGEST_API_KEY
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const apiKey = process.env.INGEST_API_KEY;
    if (!apiKey) {
      // No key configured — allow access (dev mode)
      return NextResponse.next();
    }

    const cookie = request.cookies.get("admin_key")?.value;
    const query = request.nextUrl.searchParams.get("key");

    if (cookie === apiKey || query === apiKey) {
      // Valid — set cookie so they don't need ?key= every time
      const response = NextResponse.next();
      if (query === apiKey && cookie !== apiKey) {
        response.cookies.set("admin_key", apiKey, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }
      return response;
    }

    return NextResponse.json({ error: "Unauthorized. Add ?key=YOUR_KEY" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
