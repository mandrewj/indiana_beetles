/**
 * POST /api/github/commit
 *
 * Atomically commits one or more files to the repo's main branch using
 * GitHub's Git Data API (blobs → tree → commit → ref update). All files
 * land in a single commit; downstream Vercel build sees them together.
 *
 * Auth: requires the gh_session cookie set by /api/callback. Returns 401
 * if the editor hasn't authenticated through Decap recently.
 *
 * Request body:
 *   {
 *     message: string,             // commit message
 *     files: Array<{               // 1..N files
 *       path: string,              // repo-relative, e.g. "data/species/foo.json"
 *       content: string            // file contents (UTF-8)
 *     }>
 *   }
 *
 * Response:
 *   { ok: true, commit: { sha, url } }   OR   { ok: false, error: string }
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  readGhTokenFromRequest,
  REPO_BRANCH,
  REPO_NAME,
  REPO_OWNER,
} from "@/lib/auth";

export const runtime = "nodejs";

interface CommitRequest {
  message: string;
  files: Array<{ path: string; content: string }>;
}

const API = "https://api.github.com";

async function gh<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export async function POST(req: NextRequest) {
  const token = readGhTokenFromRequest(req);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Not signed in. Open /admin/ and sign in via GitHub first." },
      { status: 401 }
    );
  }

  let body: CommitRequest;
  try {
    body = (await req.json()) as CommitRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.message || !Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Body must include `message` and a non-empty `files` array." },
      { status: 400 }
    );
  }
  for (const f of body.files) {
    if (typeof f.path !== "string" || typeof f.content !== "string") {
      return NextResponse.json(
        { ok: false, error: "Each file needs string `path` and `content`." },
        { status: 400 }
      );
    }
    // Hard-stop guard: only allow writes inside data/ — no path traversal,
    // no overwriting config.yml or arbitrary code.
    if (
      !f.path.startsWith("data/") ||
      f.path.includes("..") ||
      f.path.includes("\\") ||
      f.path.startsWith("/")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Refusing to write outside data/: ${f.path}`,
        },
        { status: 400 }
      );
    }
  }

  const owner = REPO_OWNER;
  const repo = REPO_NAME;
  const branch = REPO_BRANCH;

  try {
    // 1. Get the SHA of the current tip of main.
    const ref = await gh<{ object: { sha: string } }>(
      token,
      `/repos/${owner}/${repo}/git/refs/heads/${branch}`
    );
    const parentCommitSha = ref.object.sha;

    // 2. Get the tree SHA of that commit so we can extend it.
    const parentCommit = await gh<{ tree: { sha: string } }>(
      token,
      `/repos/${owner}/${repo}/git/commits/${parentCommitSha}`
    );
    const baseTreeSha = parentCommit.tree.sha;

    // 3. Create blobs for each file.
    const blobs = await Promise.all(
      body.files.map(async (f) => {
        const blob = await gh<{ sha: string }>(
          token,
          `/repos/${owner}/${repo}/git/blobs`,
          {
            method: "POST",
            body: JSON.stringify({
              content: f.content,
              encoding: "utf-8",
            }),
          }
        );
        return { path: f.path, sha: blob.sha };
      })
    );

    // 4. Create a tree that extends base with the new blobs.
    const tree = await gh<{ sha: string }>(
      token,
      `/repos/${owner}/${repo}/git/trees`,
      {
        method: "POST",
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: blobs.map((b) => ({
            path: b.path,
            mode: "100644",
            type: "blob",
            sha: b.sha,
          })),
        }),
      }
    );

    // 5. Create the commit.
    const commit = await gh<{ sha: string; html_url: string }>(
      token,
      `/repos/${owner}/${repo}/git/commits`,
      {
        method: "POST",
        body: JSON.stringify({
          message: body.message,
          tree: tree.sha,
          parents: [parentCommitSha],
        }),
      }
    );

    // 6. Move the branch ref to the new commit.
    await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });

    return NextResponse.json({
      ok: true,
      commit: { sha: commit.sha, url: commit.html_url },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
