const COOKIE_NAME = "beta_auth";
const TEST_FALLBACK_PASSWORD = "cba";

export const config = {
  matcher: ["/beta", "/beta/:path*"],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const password = process.env.BETA_PASSWORD || TEST_FALLBACK_PASSWORD;

  if (isAuthed(request, password)) {
    return new Response(null, { headers: { "x-middleware-next": "1" } });
  }

  const showError = url.searchParams.get("error") === "1";
  return new Response(loginHtml(showError ? "Wrong password." : ""), {
    status: showError ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function isAuthed(request, password) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const entries = cookieHeader.split(";").map((c) => c.trim());
  const match = entries.find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  try {
    return decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) === password;
  } catch {
    return false;
  }
}

function loginHtml(error = "") {
  const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
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
