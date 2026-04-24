// Vercel Edge Middleware. Gates /beta and /admin behind password-protected
// login forms.
//
// Auth model:
//   - /beta requires BETA_PASSWORD (cookie: beta_auth). An admin_auth cookie
//     also satisfies /beta, so admins don't get double-challenged.
//   - /admin requires ADMIN_PASSWORD (cookie: admin_auth). Beta cookies do
//     NOT satisfy /admin.
//
// Cleanups vs the old app:
//   1. Cookies store HMAC-SHA256(password, "ok"), so a cookie leak does not
//      leak the password (HMAC is one-way).
//   2. No fallback password. If the required env var is missing the middleware
//      fails closed with a 500. No default-cba back door.

const BETA_COOKIE = "beta_auth";
const ADMIN_COOKIE = "admin_auth";

export const config = {
  matcher: ["/beta", "/beta/:path*", "/admin", "/admin/:path*"],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const isAdmin = url.pathname.startsWith("/admin");

  const betaPassword = process.env.BETA_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (isAdmin && !adminPassword) {
    return new Response("Admin auth not configured. Set ADMIN_PASSWORD.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!isAdmin && !betaPassword) {
    return new Response("Beta auth not configured. Set BETA_PASSWORD.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const cookies = parseCookies(request.headers.get("cookie") ?? "");

  if (isAdmin) {
    const expected = await signOk(adminPassword);
    if (constantTimeEqual(cookies[ADMIN_COOKIE] ?? "", expected)) {
      return new Response(null, { headers: { "x-middleware-next": "1" } });
    }
  } else {
    const betaExpected = await signOk(betaPassword);
    if (constantTimeEqual(cookies[BETA_COOKIE] ?? "", betaExpected)) {
      return new Response(null, { headers: { "x-middleware-next": "1" } });
    }
    if (adminPassword) {
      const adminExpected = await signOk(adminPassword);
      if (constantTimeEqual(cookies[ADMIN_COOKIE] ?? "", adminExpected)) {
        return new Response(null, { headers: { "x-middleware-next": "1" } });
      }
    }
  }

  const showError = url.searchParams.get("error") === "1";
  const redirect = isAdmin ? "/admin/" : "/beta/";
  return new Response(loginHtml(showError ? "Wrong password." : "", redirect), {
    status: showError ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function parseCookies(header) {
  const out = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
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

function loginHtml(error = "", redirect = "/beta/") {
  const isAdmin = redirect === "/admin/";
  const heading = isAdmin ? "Chase Bliss Admin" : "Chase Bliss Beta";
  const pageTitle = isAdmin ? "Admin Access" : "Beta Access";
  const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  const redirectInput = `<input type="hidden" name="redirect" value="${escapeHtml(redirect)}">`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(pageTitle)} — Chase Bliss</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { font-family: "Poppins", sans-serif; background: #fefbf6; color: #000; }
  body { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 7vw; gap: 2rem; -webkit-font-smoothing: antialiased; line-height: 1.5; }
  .brand { width: 100%; max-width: 384px; color: #000; }
  .brand svg { display: block; width: 100%; height: auto; overflow: visible; }

  /* Mark: 3 shapes hop in from the left, staggered. */
  .logo-mark > * { opacity: 0; transform-origin: 50% 50%; animation: hopIn 0.9s cubic-bezier(.3,1.4,.5,1) forwards; }
  .logo-mark > *:nth-child(1) { animation-delay: 0.05s; }
  .logo-mark > *:nth-child(2) { animation-delay: 0.25s; }
  .logo-mark > *:nth-child(3) { animation-delay: 0.45s; }

  /* Wordmark: fade + slide up, staggered. */
  .logo-wordmark > * {
    opacity: 0;
    transform: translateY(8px);
    animation: wordUp 0.55s ease-out forwards;
    animation-delay: 0.6s;
  }
  .logo-wordmark > *:nth-child(1)  { animation-delay: 0.60s; }
  .logo-wordmark > *:nth-child(2)  { animation-delay: 0.64s; }
  .logo-wordmark > *:nth-child(3)  { animation-delay: 0.68s; }
  .logo-wordmark > *:nth-child(4)  { animation-delay: 0.72s; }
  .logo-wordmark > *:nth-child(5)  { animation-delay: 0.76s; }
  .logo-wordmark > *:nth-child(6)  { animation-delay: 0.80s; }
  .logo-wordmark > *:nth-child(7)  { animation-delay: 0.84s; }
  .logo-wordmark > *:nth-child(8)  { animation-delay: 0.88s; }
  .logo-wordmark > *:nth-child(9)  { animation-delay: 0.92s; }
  .logo-wordmark > *:nth-child(10) { animation-delay: 0.96s; }
  .logo-wordmark > *:nth-child(11) { animation-delay: 1.00s; }

  @keyframes hopIn {
    0%   { opacity: 0; transform: translate(-60px, 0) rotate(-180deg) scale(0.9); }
    60%  { opacity: 1; transform: translate(0, -18px) rotate(0deg) scale(1.04); }
    80%  { transform: translate(0, 0) scale(0.96); }
    100% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
  }
  @keyframes wordUp {
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .logo-mark > *, .logo-wordmark > * { animation: none; opacity: 1; transform: none; }
  }

  canvas.mouse-trail { position: fixed; inset: 0; pointer-events: none; z-index: 1000; }

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
<div class="brand" aria-label="Chase Bliss">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 776.71 102.88" fill="currentColor" aria-hidden="true">
    <g class="logo-mark">
      <path d="M7.84,53.11a63.34,63.34,0,0,0-7.84.5v49.27H70.38A64.2,64.2,0,0,0,7.84,53.11Z"/>
      <path d="M90,51.44a12.86,12.86,0,0,1,12.86-12.86V0A51.45,51.45,0,0,0,53.22,38L53.06,38.59a51.48,51.48,0,0,0,49.82,64.29V64.3A12.86,12.86,0,0,1,90,51.44Z"/>
      <path d="M38.22,0L0,15.09L15.14,53.54L53.06,38.59Z"/>
    </g>
    <g class="logo-wordmark" transform="translate(0 10)">
      <path d="M658,19.75v63H645.36v-63Z"/>
      <path d="M682.94,80.11a22.58,22.58,0,0,1-9-7.09,17.69,17.69,0,0,1-3.56-10h13a8.91,8.91,0,0,0,3.72,6.48,13.46,13.46,0,0,0,8.47,2.6c3.54,0,6.31-.68,8.26-2a6.17,6.17,0,0,0,2.93-5.25,5.43,5.43,0,0,0-3.25-5.1A61.29,61.29,0,0,0,693.19,56,99.23,99.23,0,0,1,682,52.4,19.62,19.62,0,0,1,674.52,47q-3.15-3.6-3.15-9.64a15,15,0,0,1,2.87-8.92A19.19,19.19,0,0,1,682.52,22a30.75,30.75,0,0,1,12.35-2.32q10.41,0,16.79,5.25t6.81,14.35H705.84a9,9,0,0,0-3.33-6.54q-3-2.43-8.11-2.43t-7.64,1.88a5.83,5.83,0,0,0-2.71,5,5.41,5.41,0,0,0,1.81,4.09,12.66,12.66,0,0,0,4.32,2.61q2.55.94,7.54,2.38a82.47,82.47,0,0,1,10.91,3.61A20.42,20.42,0,0,1,716,55.28a14.27,14.27,0,0,1,3.21,9.41A15.81,15.81,0,0,1,716.33,74a19.11,19.11,0,0,1-8.12,6.43,30.42,30.42,0,0,1-12.35,2.33A30.9,30.9,0,0,1,682.94,80.11Z"/>
      <path d="M740.46,80.11a22.55,22.55,0,0,1-9-7.09,17.59,17.59,0,0,1-3.54-10H741a8.94,8.94,0,0,0,3.72,6.48,13.49,13.49,0,0,0,8.48,2.6c3.54,0,6.31-.68,8.25-2a6.17,6.17,0,0,0,2.93-5.25,5.41,5.41,0,0,0-3.27-5.1A61,61,0,0,0,750.71,56a99.89,99.89,0,0,1-11.19-3.61A19.62,19.62,0,0,1,732,47c-2.09-2.4-3.15-5.62-3.15-9.64a15.12,15.12,0,0,1,2.88-8.92A19.13,19.13,0,0,1,740,22.06a30.92,30.92,0,0,1,12.35-2.32q10.39,0,16.78,5.26T776,39.34H763.35A9,9,0,0,0,760,32.81c-2-1.63-4.7-2.44-8.12-2.44s-5.87.63-7.64,1.89a5.82,5.82,0,0,0-2.7,5,5.42,5.42,0,0,0,1.8,4.1,12.68,12.68,0,0,0,4.33,2.6c1.7.6,4.21,1.4,7.53,2.38a83.46,83.46,0,0,1,10.91,3.61,20.25,20.25,0,0,1,7.37,5.41,14.28,14.28,0,0,1,3.21,9.42,15.73,15.73,0,0,1-2.88,9.3,19.07,19.07,0,0,1-8.11,6.43,30.27,30.27,0,0,1-12.36,2.33A30.83,30.83,0,0,1,740.46,80.11Z"/>
      <path d="M591.67,34.65a28.3,28.3,0,0,0-11.18-11.08,34.25,34.25,0,0,0-31.69,0,31.1,31.1,0,0,0-2.7,1.67V.75H533.47v82H546.1V77.32c.74.52,1.52,1,2.32,1.48A31.26,31.26,0,0,0,564,82.73a33.12,33.12,0,0,0,16-3.93,29.13,29.13,0,0,0,11.46-11.13,32.16,32.16,0,0,0,4.21-16.51A32.73,32.73,0,0,0,591.67,34.65ZM580.16,62.49a17.82,17.82,0,0,1-6.93,7,18.85,18.85,0,0,1-9.14,2.33,16.62,16.62,0,0,1-12.68-5.41q-5.05-5.41-5-15.23A23.76,23.76,0,0,1,548.8,40,16.56,16.56,0,0,1,555.39,33a18.15,18.15,0,0,1,9-2.32A18.52,18.52,0,0,1,573.5,33,17.23,17.23,0,0,1,580.27,40a23,23,0,0,1,2.55,11.24A22.56,22.56,0,0,1,580.16,62.49Z"/>
      <circle cx="651.69" cy="7.75" r="6.82"/>
      <path d="M621.78,66.36V.81H609.15V70.1a12.71,12.71,0,0,0,12.71,12.71h9.46V70.2h-5.7A3.84,3.84,0,0,1,621.78,66.36Z"/>
      <path d="M167.28,34.48a27.05,27.05,0,0,1,10.58-11,30.48,30.48,0,0,1,15.51-3.88q11.07,0,18.33,5.26a25.75,25.75,0,0,1,9.81,15H207.88a14.41,14.41,0,0,0-5.32-7.09,15.6,15.6,0,0,0-9.19-2.55A15.25,15.25,0,0,0,181,35.7q-4.59,5.47-4.6,15.33T181,66.42A15.24,15.24,0,0,0,193.37,72q11,0,14.51-9.63h13.63a27.34,27.34,0,0,1-10,14.79q-7.34,5.48-18.16,5.48a30.38,30.38,0,0,1-15.51-3.93,27.59,27.59,0,0,1-10.58-11.08,34.54,34.54,0,0,1-3.82-16.56A34.55,34.55,0,0,1,167.28,34.48Z"/>
      <path d="M384.5,80a22.5,22.5,0,0,1-9-7.08,17.66,17.66,0,0,1-3.54-10H385a8.9,8.9,0,0,0,3.71,6.48A13.49,13.49,0,0,0,397.2,72c3.54,0,6.31-.68,8.25-2a6.17,6.17,0,0,0,2.93-5.26,5.4,5.4,0,0,0-3.27-5.09,61.6,61.6,0,0,0-10.36-3.66,99.89,99.89,0,0,1-11.19-3.61,19.62,19.62,0,0,1-7.48-5.41q-3.16-3.6-3.16-9.64a15,15,0,0,1,2.89-8.92A19.18,19.18,0,0,1,384.06,22a30.92,30.92,0,0,1,12.35-2.32q10.41,0,16.79,5.25T420,39.25H407.38a9,9,0,0,0-3.33-6.54,12.49,12.49,0,0,0-8.11-2.43q-5.13,0-7.65,1.88a5.85,5.85,0,0,0-2.61,4.93,5.38,5.38,0,0,0,1.81,4.09,12.57,12.57,0,0,0,4.32,2.61c1.69.63,4.21,1.42,7.53,2.38a82.47,82.47,0,0,1,10.91,3.61,20.3,20.3,0,0,1,7.36,5.41,14.22,14.22,0,0,1,3.22,9.41A15.88,15.88,0,0,1,418,73.91a19.11,19.11,0,0,1-8.12,6.43,30.37,30.37,0,0,1-12.42,2.28A30.82,30.82,0,0,1,384.5,80Z"/>
      <path d="M488.27,55.81H441.63A16.82,16.82,0,0,0,459,72q10.19,0,14.43-8.53h13.6a27.6,27.6,0,0,1-10,13.8q-7.22,5.4-18,5.41a31.26,31.26,0,0,1-15.68-3.94,27.92,27.92,0,0,1-10.82-11.08,33.72,33.72,0,0,1-3.93-16.56,34.76,34.76,0,0,1,3.81-16.56,26.89,26.89,0,0,1,10.75-11A32,32,0,0,1,459,19.63a31.1,31.1,0,0,1,15.4,3.76A26.7,26.7,0,0,1,485,33.93a31.94,31.94,0,0,1,3.76,15.68A39,39,0,0,1,488.27,55.81ZM475.53,45.62a14.39,14.39,0,0,0-5-11.19,17.85,17.85,0,0,0-12.09-4.21,16.22,16.22,0,0,0-11.18,4.15,17.44,17.44,0,0,0-5.55,11.25Z"/>
      <path d="M359.85,51.05V19.79H347.06V25a28.5,28.5,0,0,0-2.54-1.53,34.25,34.25,0,0,0-31.69,0,28.37,28.37,0,0,0-11.19,11.07,32.83,32.83,0,0,0-4.09,16.51,33.42,33.42,0,0,0,4,16.56,28.3,28.3,0,0,0,11,11.08,31.38,31.38,0,0,0,15.62,3.94,31.81,31.81,0,0,0,18.94-5.76v5.85H359.8V51.46C359.8,51.32,359.85,51.18,359.85,51.05Zm-15.66,11.3a17.83,17.83,0,0,1-6.88,7,18.73,18.73,0,0,1-9.14,2.32,16.62,16.62,0,0,1-12.68-5.41q-5.06-5.4-5.05-15.23a23.77,23.77,0,0,1,2.44-11.24,16.56,16.56,0,0,1,6.59-6.93,18.13,18.13,0,0,1,9-2.33,18.64,18.64,0,0,1,9.09,2.33,17.18,17.18,0,0,1,6.75,6.93A22.88,22.88,0,0,1,346.89,51,22.54,22.54,0,0,1,344.19,62.35Z"/>
      <path d="M280.33,28a24.27,24.27,0,0,0-10.69-6.62,32.75,32.75,0,0,0-9.83-1.42,29.59,29.59,0,0,0-15.15,3.73V.75H232v82h12.63V48.62q0-8.22,4.16-12.63t11.23-4.37q7.09,0,11.19,4.37t4.11,12.63V82.73h12.51V51Q287.85,36,280.33,28Z"/>
    </g>
  </svg>
</div>
<form method="POST" action="/api/beta-login" autocomplete="off">
  <h1>${escapeHtml(heading)}</h1>
  ${errorHtml}
  ${redirectInput}
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autofocus required>
  <button type="submit">Enter</button>
</form>
<canvas class="mouse-trail" aria-hidden="true"></canvas>
<script>
(function () {
  var COLOR = "#ba8e51";
  var GRID = 14;
  var FONT = 13;
  var LIFE = 600;
  var SEL = 'button, a, input, select, textarea, label, [role="button"], [role="listbox"], [role="option"], [role="dialog"], [data-no-trail]';

  var canvas = document.querySelector("canvas.mouse-trail");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var dpr = window.devicePixelRatio || 1;
  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  var trail = [];
  window.addEventListener("mousemove", function (e) {
    var hit = document.elementFromPoint(e.clientX, e.clientY);
    if (hit && hit.closest && hit.closest(SEL)) return;
    var gx = Math.floor(e.clientX / GRID) * GRID;
    var gy = Math.floor(e.clientY / GRID) * GRID;
    var last = trail[trail.length - 1];
    if (!last || last.x !== gx || last.y !== gy) {
      trail.push({
        x: gx,
        y: gy,
        birth: performance.now(),
        ch: Math.random() < 0.5 ? "0" : "1",
      });
    }
  });

  function frame() {
    var now = performance.now();
    var live = [];
    for (var i = 0; i < trail.length; i++) {
      if (now - trail[i].birth < LIFE) live.push(trail[i]);
    }
    trail = live;

    var rects = [];
    var els = document.querySelectorAll(SEL);
    for (var j = 0; j < els.length; j++) {
      var s = window.getComputedStyle(els[j]);
      if (s.opacity === "0" || s.visibility === "hidden" || s.display === "none" || s.pointerEvents === "none") continue;
      var r = els[j].getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rects.push(r);
    }
    function blocked(x, y) {
      for (var k = 0; k < rects.length; k++) {
        var r = rects[k];
        if (x + FONT >= r.left && x <= r.right && y + FONT >= r.top && y <= r.bottom) return true;
      }
      return false;
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.fillStyle = COLOR;
    ctx.font = '700 ' + FONT + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    for (var n = 0; n < trail.length; n++) {
      var p = trail[n];
      var px = p.x + GRID;
      if (blocked(px, p.y)) continue;
      ctx.globalAlpha = 1 - (now - p.birth) / LIFE;
      ctx.fillText(p.ch, px, p.y);
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
</script>
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
