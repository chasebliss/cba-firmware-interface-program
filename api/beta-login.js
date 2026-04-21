const TEST_FALLBACK_PASSWORD = "cba";
const COOKIE_NAME = "beta_auth";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  const password = process.env.BETA_PASSWORD || TEST_FALLBACK_PASSWORD;

  let body = "";
  await new Promise((resolve) => {
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", resolve);
  });
  const submitted = new URLSearchParams(body).get("password");

  if (typeof submitted === "string" && submitted === password) {
    const cookie = [
      `${COOKIE_NAME}=${encodeURIComponent(password)}`,
      "Path=/beta",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      `Max-Age=${MAX_AGE_SECONDS}`,
    ].join("; ");
    res.statusCode = 303;
    res.setHeader("Set-Cookie", cookie);
    res.setHeader("Location", "/beta/");
    return res.end();
  }

  res.statusCode = 303;
  res.setHeader("Location", "/beta/?error=1");
  res.end();
};
