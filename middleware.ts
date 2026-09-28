import { NextRequest, NextResponse } from "next/server";

// Simple HTTP Basic Auth gate. This dashboard holds real candidate names, emails,
// and drafted rejection/interview decisions, so the deployed site is never open
// by default — set SITE_PASSWORD in Vercel env vars to enable it.
export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next(); // no password configured (e.g. local dev) — allow through

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const [, suppliedPassword] = decoded.split(":");
      if (suppliedPassword === password) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kargo Hiring Dashboard"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
