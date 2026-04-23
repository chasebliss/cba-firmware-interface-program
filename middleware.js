// Vercel Edge Middleware. Gates /beta behind a password-protected login form.
//
// Cleanups vs the old app:
//   1. The cookie no longer stores the plain password. It stores
//      HMAC-SHA256(BETA_PASSWORD, "ok"), so a cookie leak does not leak the
//      password (HMAC is one-way).
//   2. No fallback password. If BETA_PASSWORD is missing the middleware
//      fails closed with a 500. No default-cba back door.

const COOKIE_NAME = "beta_auth";

export const config = {
  matcher: ["/beta", "/beta/:path*", "/admin", "/admin/:path*"],
};

export default async function middleware(request) {
  const password = process.env.BETA_PASSWORD;
  if (!password) {
    return new Response("Beta auth not configured. Set BETA_PASSWORD.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const expected = await signOk(password);
  if (await isAuthed(request, expected)) {
    return new Response(null, { headers: { "x-middleware-next": "1" } });
  }

  const url = new URL(request.url);
  const showError = url.searchParams.get("error") === "1";
  const redirect = safeRedirect(url.pathname);
  return new Response(loginHtml(showError ? "Wrong password." : "", redirect), {
    status: showError ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function safeRedirect(pathname) {
  if (pathname.startsWith("/beta")) return "/beta/";
  if (pathname.startsWith("/admin")) return "/admin/";
  return "/beta/";
}

async function signOk(password) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("ok"),
  );
  return base64UrlEncode(new Uint8Array(sig));
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function isAuthed(request, expected) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  const value = match.slice(COOKIE_NAME.length + 1);
  return constantTimeEqual(value, expected);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function loginHtml(error = "", redirect = "/beta/") {
  const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  const redirectInput = `<input type="hidden" name="redirect" value="${escapeHtml(redirect)}">`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Beta Access — Chase Bliss</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { font-family: "Poppins", sans-serif; background: #fefbf6; color: #000; }
  body { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 0 7vw; -webkit-font-smoothing: antialiased; line-height: 1.5; }
  form { background: #fefbf6; padding: 2rem; border: 2px solid #000; width: 100%; max-width: 384px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
  h1 { margin: 0 0 1.25rem; font-size: 1.125rem; font-weight: 700; }
  label { display: block; margin-bottom: 0.5rem; font-weight: 700; font-size: 0.875rem; }
  input { width: 100%; padding: 10px; margin-bottom: 1rem; background: #fefbf6; border: 2px solid #000; font: inherit; font-weight: 700; }
  input:focus { outline: 2px solid #000; outline-offset: 2px; }
  button { width: 100%; min-width: 204px; height: 50px; padding: 10px; background: #fefbf6; border: 2px solid #000; font: inherit; font-weight: 700; cursor: pointer; transition: box-shadow 0.3s ease-in-out; }
  button:hover { font-style: italic; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
  .error { margin: 0 0 0.75rem; padding: 0.5rem 0.75rem; border: 2px solid #c00; color: #c00; font-weight: 700; font-size: 0.875rem; }
</style>
</head>
<body>
<form method="POST" action="/api/beta-login" autocomplete="off">
  <h1>Chase Bliss Beta</h1>
  ${errorHtml}
  ${redirectInput}
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autofocus required>
  <button type="submit">Enter</button>
</form>
</body>
</html>`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
