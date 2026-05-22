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
