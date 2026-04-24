// Vercel Node.js serverless function. Verifies the beta/admin password
// submitted by the login form and sets a signed cookie that middleware.js
// checks.
//
// Routing: the form's hidden `redirect` field ("/beta/" or "/admin/") picks
// which password to verify and which cookie to set. On the beta login,
// either password works — the admin cookie also satisfies /beta, so an
// admin typing their password at /beta gets through. The admin login
// only accepts ADMIN_PASSWORD.
//
// Cleanups vs the old app:
//   1. Cookie value is HMAC-SHA256(password, "ok"), not the plain password.
//   2. No TEST_FALLBACK_PASSWORD. Missing env var fails closed with a 500.
//   3. Password comparison is constant-time.

const BETA_COOKIE = "beta_auth";
const ADMIN_COOKIE = "admin_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  let body = "";
  await new Promise((resolve) => {
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", resolve);
  });
  const params = new URLSearchParams(body);
  const submitted = params.get("password");
  const redirect = safeRedirect(params.get("redirect"));
  const isAdmin = redirect === "/admin/";

  const betaPassword = process.env.BETA_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (isAdmin && !adminPassword) {
    res.statusCode = 500;
    return res.end("Admin auth not configured. Set ADMIN_PASSWORD.");
  }
  if (!isAdmin && !betaPassword) {
    res.statusCode = 500;
    return res.end("Beta auth not configured. Set BETA_PASSWORD.");
  }

  const match = matchPassword(submitted, {
    isAdmin,
    betaPassword,
    adminPassword,
  });
  if (!match) {
    res.statusCode = 303;
    res.setHeader("Location", `${redirect}?error=1`);
    return res.end();
  }

  const cookieName = match === "admin" ? ADMIN_COOKIE : BETA_COOKIE;
  const token = await signOk(
    match === "admin" ? adminPassword : betaPassword,
  );
  const cookie = [
    `${cookieName}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=43200", // 12 hours
  ].join("; ");
  res.statusCode = 303;
  res.setHeader("Set-Cookie", cookie);
  res.setHeader("Location", redirect);
  res.end();
}

function matchPassword(submitted, { isAdmin, betaPassword, adminPassword }) {
  if (typeof submitted !== "string") return null;
  if (isAdmin) {
    return constantTimeEqual(submitted, adminPassword) ? "admin" : null;
  }
  if (adminPassword && constantTimeEqual(submitted, adminPassword)) {
    return "admin";
  }
  if (constantTimeEqual(submitted, betaPassword)) return "beta";
  return null;
}

function safeRedirect(value) {
  if (value === "/beta/" || value === "/admin/") return value;
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

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
