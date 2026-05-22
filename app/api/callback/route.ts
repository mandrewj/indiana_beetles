/**
 * GitHub OAuth — step 2.
 *
 * GitHub redirects back here with ?code=&state=. We:
 *   1. verify the state matches the cookie set by /api/auth
 *   2. POST the code to GitHub's token endpoint
 *   3. respond with a small HTML page that does the postMessage handshake
 *      Decap expects from a self-hosted OAuth proxy.
 */
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function html(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function responseHtml(payload: {
  status: "success" | "error";
  message: string;
  token?: string;
  provider: "github";
}): string {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Authorizing…</title></head>
<body>
<script>
  (function () {
    function send(e) {
      const msg = 'authorization:github:${payload.status}:' + ${JSON.stringify(JSON.stringify({
        token: payload.token,
        provider: payload.provider,
      }))};
      // Decap listens for postMessage handshake: receive 'authorizing:github',
      // respond with 'authorization:github:<status>:<json>'.
      if (e.data === 'authorizing:github' && e.source) {
        e.source.postMessage(msg, e.origin);
      }
    }
    window.addEventListener('message', send, false);
    if (window.opener) {
      window.opener.postMessage('authorizing:github', '*');
    }
    document.body.textContent = ${JSON.stringify(payload.message)};
  })();
</script>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return html(
      "<p>OAuth is not configured: missing OAUTH_GITHUB_CLIENT_ID / OAUTH_GITHUB_CLIENT_SECRET.</p>",
      500
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("decap_oauth_state")?.value;
  if (!code || !state) {
    return html("<p>Missing OAuth `code` or `state`.</p>", 400);
  }
  if (state !== cookieState) {
    return html("<p>OAuth state mismatch — possible CSRF, request denied.</p>", 400);
  }

  // Exchange the code for an access token.
  let token: TokenResponse;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        state,
      }),
    });
    token = (await tokenRes.json()) as TokenResponse;
  } catch (err) {
    return html(
      `<p>Network error talking to GitHub: ${(err as Error).message}</p>`,
      502
    );
  }

  if (token.error || !token.access_token) {
    return html(
      responseHtml({
        status: "error",
        provider: "github",
        message: token.error_description ?? token.error ?? "Authorization failed",
      }),
      400
    );
  }

  const res = html(
    responseHtml({
      status: "success",
      provider: "github",
      token: token.access_token,
      message: "Authorization successful — you can close this window.",
    })
  );
  // Clear the state cookie now that we've used it.
  res.cookies.set("decap_oauth_state", "", { path: "/", maxAge: 0 });
  // Also drop the GitHub access token in an httpOnly cookie so our own
  // admin tools (Discover, Refresh) can commit to the repo via /api/github/*
  // without re-authenticating. Decap still gets the same token via the
  // postMessage handshake above.
  res.cookies.set("gh_session", token.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return res;
}
