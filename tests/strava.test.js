// Tests for the Strava connection: app/run.js (pure functions) and netlify/functions/strava.mjs · run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../app/run.js");

const act = (over = {}) => Object.assign({ id: 111, name: "Morning Run", sport_type: "Run", type: "Run", distance: 7720,
  moving_time: 2558, elapsed_time: 2600, start_date: "2026-11-16T07:00:00Z", trainer: false }, over);
const START = Date.parse("2026-11-16T07:00:00Z");

/* ---------- app side ---------- */
test("login link asks Strava for read access with our state", () => {
  const u = new URL(R.stravaAuthUrl({ clientId: 12345, redirect: "https://novafit.netlify.app/", state: "abc" }));
  assert.equal(u.origin + u.pathname, "https://www.strava.com/oauth/authorize");
  assert.equal(u.searchParams.get("client_id"), "12345");
  assert.equal(u.searchParams.get("redirect_uri"), "https://novafit.netlify.app/");
  assert.equal(u.searchParams.get("scope"), "activity:read_all");
  assert.equal(u.searchParams.get("state"), "abc");
});

test("scope check: access to activities is required", () => {
  assert.equal(R.stravaScopeOk("read,activity:read_all"), true);
  assert.equal(R.stravaScopeOk("read,activity:read"), true);
  assert.equal(R.stravaScopeOk("read"), false);
  assert.equal(R.stravaScopeOk(""), false);
});

test("a Strava run becomes a NOVAFit entry", () => {
  const e = R.stravaEntry(act(), 7.4);
  assert.equal(e.id, "st111");
  assert.equal(e.type, "lauf");
  assert.equal(e.start, START);
  assert.equal(e.end, START + 2600 * 1000);
  assert.deepEqual(e.run, { mode: "alster", km: 7.72, min: 2558 / 60, note: "", strava: "111" });
});

test("treadmill and own titles", () => {
  assert.equal(R.stravaEntry(act({ trainer: true }), 7.4).run.mode, "band");
  assert.equal(R.stravaEntry(act({ sport_type: "VirtualRun" }), 7.4).run.mode, "band");
  assert.equal(R.stravaEntry(act({ distance: 10000 }), 7.4).run.mode, "out");
  assert.equal(R.stravaEntry(act({ name: "Tempo along the river" }), 7.4).run.note, "Tempo along the river");
});

test("only new runs are imported", () => {
  const acts = [
    act({ id: 1 }),                                                    // already imported
    act({ id: 2, start_date: "2026-11-14T18:00:00Z" }),                // logged by hand the same day
    act({ id: 3, sport_type: "Ride", type: "Ride" }),                  // a ride
    act({ id: 4, start_date: "2026-11-15T17:00:00Z", distance: 5000 }),// new
    act({ id: 5, start_date: "2026-11-13T17:00:00Z", distance: 3000 }) // new, older
  ];
  const history = [
    { id: "st1", start: START, run: { km: 7.72, strava: "1" } },
    { id: "s9", start: Date.parse("2026-11-14T18:03:00Z"), run: { km: 7.7 } }
  ];
  const n = R.stravaNew(history, acts, 7.4);
  assert.deepEqual(n.map(e => e.run.strava), ["5", "4"]);
});

/* ---------- server side: netlify/functions/strava.mjs ---------- */
async function withFn(fakeStrava, fn) {
  const { default: handler } = await import("../netlify/functions/strava.mjs");
  const realFetch = global.fetch, calls = [];
  process.env.STRAVA_CLIENT_ID = "12345"; process.env.STRAVA_CLIENT_SECRET = "s3cret";
  global.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); const [status, body] = fakeStrava(String(url), init); return new Response(JSON.stringify(body), { status }); };
  const call = async (body, method = "POST") => {
    const res = await handler(new Request("https://x/.netlify/functions/strava", method === "GET" ? {} : { method, body: typeof body === "string" ? body : JSON.stringify(body) }));
    return { status: res.status, body: await res.json() };
  };
  try { await fn(call, calls); } finally { global.fetch = realFetch; delete process.env.STRAVA_CLIENT_ID; delete process.env.STRAVA_CLIENT_SECRET; }
}
const TOK = "a".repeat(40), REF = "b".repeat(40);

test("function: gives the public client id, never the secret", async () => {
  await withFn(() => [500, {}], async (call) => {
    const r = await call(null, "GET");
    assert.deepEqual(r.body, { clientId: "12345" });
    assert.ok(!JSON.stringify(r.body).includes("s3cret"));
  });
});

test("function: exchanges the code with the secret and returns only what the app needs", async () => {
  await withFn(() => [200, { access_token: TOK, refresh_token: REF, expires_at: 1800000000, athlete: { firstname: "Tassilo", lastname: "X", city: "Lisbon" } }], async (call, calls) => {
    const r = await call({ action: "token", code: "c0de1234567890" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { access_token: TOK, refresh_token: REF, expires_at: 1800000000, firstname: "Tassilo" });
    const sent = new URLSearchParams(String(calls[0].init.body));
    assert.equal(calls[0].url, "https://www.strava.com/oauth/token");
    assert.equal(sent.get("client_secret"), "s3cret");
    assert.equal(sent.get("grant_type"), "authorization_code");
  });
});

test("function: activities are fetched with the runner's token", async () => {
  await withFn(() => [200, [act({ map: { polyline: "xyz" }, athlete: { id: 9 } })]], async (call, calls) => {
    const r = await call({ action: "activities", access_token: TOK, after: 1790000000 });
    assert.equal(r.status, 200);
    assert.equal(r.body.activities[0].distance, 7720);
    assert.equal(r.body.activities[0].map, undefined, "no GPS track is passed on");
    assert.equal(calls[0].init.headers.Authorization, "Bearer " + TOK);
    assert.match(calls[0].url, /after=1790000000/);
  });
});

test("function: a whole year comes page by page", async () => {
  await withFn(() => [200, []], async (call, calls) => {
    assert.equal((await call({ action: "activities", access_token: TOK, after: 1767225600, page: 3 })).status, 200);
    assert.match(calls[0].url, /page=3&per_page=100/);
    assert.equal((await call({ action: "activities", access_token: TOK, after: 0, page: 0 })).status, 400);
    assert.equal((await call({ action: "activities", access_token: TOK, after: 0, page: 99 })).status, 400);
  });
});

test("function: expired token and rate limit are passed on clearly", async () => {
  await withFn(() => [401, { message: "Authorization Error" }], async (call) => {
    assert.deepEqual(await call({ action: "activities", access_token: TOK, after: 0 }), { status: 401, body: { error: "unauthorized" } });
  });
  await withFn(() => [429, {}], async (call) => {
    assert.equal((await call({ action: "activities", access_token: TOK, after: 0 })).status, 429);
  });
  await withFn(() => [400, { message: "Bad Request" }], async (call) => {
    assert.equal((await call({ action: "token", code: "usedcode1234" })).status, 401);
  });
});

test("function: bad input is refused without calling Strava", async () => {
  await withFn(() => { throw new Error("must not call Strava"); }, async (call) => {
    assert.equal((await call("not json")).status, 400);
    assert.equal((await call({ action: "token", code: "x" })).status, 400);
    assert.equal((await call({ action: "activities", access_token: "bad token!" })).status, 400);
    assert.equal((await call({ action: "nope" })).status, 400);
    assert.equal((await call({}, "DELETE")).status, 405);
  });
});

test("function: without the secret it says it is not set up", async () => {
  const { default: handler } = await import("../netlify/functions/strava.mjs");
  const res = await handler(new Request("https://x/", {}));
  assert.equal(res.status, 503);
});
