// Vercel Node.js serverless function. Verifies the beta password submitted
// by the login form and sets a signed cookie that middleware.js checks.
//
// Cleanups vs the old app:
//   1. Cookie value is HMAC-SHA256(BETA_PASSWORD, "ok"), not the plain password.
//      HMAC is one-way so a cookie leak cannot recover the password.
//   2. No TEST_FALLBACK_PASSWORD. Missing env var fails closed with a 500.
//   3. Password comparison is constant-time.

const COOKIE_NAME = "beta_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  const password = process.env.BETA_PASSWORD;
  if (!password) {
    res.statusCode = 500;
    return res.end("Beta auth not configured. Set BETA_PASSWORD.");
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

  if (typeof submitted !== "string" || !constantTimeEqual(submitted, password)) {
    res.statusCode = 303;
    res.setHeader("Location", `${redirect}?error=1`);
    return res.end();
  }

  const token = await signOk(password);
  const cookie = [
    `${COOKIE_NAME}=${token}`,
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
