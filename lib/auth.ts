import "server-only";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "gh_session";

/**
 * Read the editor's GitHub access token from the session cookie, set by
 * /api/callback after a successful Decap OAuth login.
 *
 * Returns null when the editor isn't signed in. Caller is responsible for
 * deciding how to respond (redirect to /admin, 401, etc.).
 */
export function readGhTokenFromCookies(): string | null {
  const c = cookies().get(COOKIE_NAME);
  return c?.value || null;
}

export function readGhTokenFromRequest(req: NextRequest): string | null {
  const c = req.cookies.get(COOKIE_NAME);
  return c?.value || null;
}

/**
 * Coordinates of the repo to commit into. Both pulled from the same source
 * Decap uses — `public/admin/config.yml`. Hard-coded here rather than parsed
 * because changing repos is a deliberate manual step.
 */
export const REPO_OWNER = "mandrewj";
export const REPO_NAME = "indiana_beetles";
export const REPO_BRANCH = "main";

/**
 * Server-side: read the cookie, verify the token with GitHub, return the
 * authenticated login. Returns null on any failure (no cookie, expired
 * token, GitHub down). Cheap — one /user call, no caching.
 */
export async function getAuthedLogin(): Promise<string | null> {
  const token = readGhTokenFromCookies();
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { login?: string };
    return data.login ?? null;
  } catch {
    return null;
  }
}
