/**
 * Client helper for POSTing to /api/github/commit. Used by the Discover and
 * Refresh tools to push edits back to the repo without re-implementing the
 * fetch + error handling each time.
 */

export interface CommitFile {
  /** Repo-relative path, e.g. "data/species/calosoma_calidum.json". */
  path: string;
  /** UTF-8 contents. */
  content: string;
}

export interface CommitResult {
  ok: true;
  commit: { sha: string; url: string };
}

export interface CommitError {
  ok: false;
  error: string;
}

export async function commitFiles(
  message: string,
  files: CommitFile[]
): Promise<CommitResult | CommitError> {
  const res = await fetch("/api/github/commit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, files }),
  });
  try {
    const json = (await res.json()) as CommitResult | CommitError;
    return json;
  } catch {
    return { ok: false, error: `HTTP ${res.status}` };
  }
}
