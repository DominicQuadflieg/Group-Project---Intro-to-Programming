// Tests for netlify/lib/guard.mjs and how the functions use it · run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");

const SITE = "https://novafit.netlify.app/.netlify/functions/strava";
const req = (headers = {}, body, url = SITE) => new Request(url, body === undefined ? { headers } : { method: "POST", headers, body });

test("same site: own origin and plain requests pass, other sites are refused", async () => {
  const { sameSite } = await import("../netlify/lib/guard.mjs");
  assert.equal(sameSite(req({ origin: "https://novafit.netlify.app" })), true);
  assert.equal(sameSite(req({})), true, "same-origin GET sends no Origin");
  assert.equal(sameSite(req({ origin: "https://evil.example" })), false);
  assert.equal(sameSite(req({ "sec-fetch-site": "cross-site" })), false);
  assert.equal(sameSite(req({ origin: "https://preview--novafit.netlify.app" }), "https://preview--novafit.netlify.app"), true);
  assert.equal(sameSite(req({ origin: "http://localhost:8888" }, undefined, "http://localhost:8888/.netlify/functions/strava")), true);
});

test("rate limit: N requests per window and key, then a wait time, then free again", async () => {
  const { makeLimiter } = await import("../netlify/lib/guard.mjs");
  let now = 0; const hit = makeLimiter(3, 60000, () => now);
  assert.deepEqual([hit("a"), hit("a"), hit("a")], [0, 0, 0]);
  assert.equal(hit("a"), 60);
  assert.equal(hit("b"), 0, "other IPs are not affected");
  now = 30000; assert.equal(hit("a"), 30);
  now = 60001; assert.equal(hit("a"), 0);
});

test("guard: refuses other sites, big bodies and too many requests", async () => {
  const { guard, makeLimiter } = await import("../netlify/lib/guard.mjs");
  const hit = makeLimiter(2, 60000);
  const ctx = { ip: "1.2.3.4" };
  assert.equal(guard(req({ origin: "https://evil.example" }), ctx, hit).status, 403);
  assert.equal(guard(req({ "content-length": "99999" }, "x"), ctx, hit).status, 413);
  assert.equal(guard(req({}), ctx, hit), null);
  assert.equal(guard(req({}), ctx, hit), null);
  const r = guard(req({}), ctx, hit);
  assert.equal(r.status, 429);
  assert.ok(+r.headers.get("retry-after") > 0);
  assert.equal(guard(req({}), { ip: "5.6.7.8" }, hit), null);
});

test("readJson refuses bodies larger than 8 KB even without Content-Length", async () => {
  const { readJson } = await import("../netlify/lib/guard.mjs");
  assert.deepEqual(await readJson(req({}, '{"a":1}')), { a: 1 });
  await assert.rejects(readJson(req({}, JSON.stringify({ x: "y".repeat(9000) }))), /too_large/);
  await assert.rejects(readJson(req({}, "not json")));
});

test("the Strava function refuses other sites too", async () => {
  const { default: handler } = await import("../netlify/functions/strava.mjs");
  process.env.STRAVA_CLIENT_ID = "1"; process.env.STRAVA_CLIENT_SECRET = "s";
  try {
    const r = await handler(req({ origin: "https://evil.example" }, JSON.stringify({ action: "token", code: "abcdefghij12" }), "https://novafit.netlify.app/.netlify/functions/strava"), { ip: "8.8.8.8" });
    assert.equal(r.status, 403);
  } finally { delete process.env.STRAVA_CLIENT_ID; delete process.env.STRAVA_CLIENT_SECRET; }
});
