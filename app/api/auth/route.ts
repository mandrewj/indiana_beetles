/**
 * GitHub OAuth — step 1.
 *
 * Decap opens a popup pointed at this route. We redirect to GitHub with the
 * scope Decap needs, plus a random state token to bind step 2 to step 1.
 *
 * The proxy here implements the same flow as the stand-alone `decap-server`
 * package, but runs inline as a Vercel Function so we don't need a second
 * deployment.
 */
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

function siteOrigin(req: NextRequest): string {
  // x-forwarded-host is set by Vercel's edge.
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  if (!clientId) {
    return new NextResponse(
      "OAUTH_GITHUB_CLIENT_ID is not configured on this deployment.",
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${siteOrigin(req)}/api/callback`;
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "repo,user");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  // Bind the state in a httpOnly cookie so /api/callback can verify it.
  res.cookies.set("decap_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
