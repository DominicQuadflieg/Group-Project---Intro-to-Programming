// Tests for "Runs near you": app/run.js (pure functions) and netlify/functions/route.mjs · run with: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../app/run.js");

const NOVA = { lat: 38.678, lon: -9.326 }, BELEM = { lat: 38.692, lon: -9.216 }, HAMBURG = { lat: 53.55, lon: 9.99 };

/* ---------- A: hand-picked routes ---------- */
test("routes are sorted by distance from you", () => {
  const r = R.nearbyRoutes(NOVA, 0);
  assert.equal(r[0].id, "carcavelos");
  assert.equal(r[0].away, 0);
  for (let i = 1; i < r.length; i++) assert.ok(r[i].away >= r[i - 1].away);
  assert.equal(R.nearbyRoutes(BELEM, 0)[0].id, "belem");
});

test("at most 4 routes, so with the loop there are never more than 5 suggestions", () => {
  assert.ok(R.NEARBY_ROUTES.length <= 4);
  assert.equal(R.MAX_SUGGESTIONS, 5);
  assert.ok(R.nearbyRoutes(NOVA, 0).length <= 4);
  assert.equal(R.nearbyRoutes(NOVA, 0, 2).length, 2);
  assert.ok(R.nearbyRoutes(NOVA, 0, 99).length <= 5);
});

test("routes that fit the next run of the plan are marked", () => {
  const r = R.nearbyRoutes(NOVA, 5);
  assert.equal(r.find(x => x.id === "carcavelos").fits, true);    // 5 km
  assert.equal(r.find(x => x.id === "belem").fits, false);         // 7 km
  assert.ok(R.nearbyRoutes(NOVA, 0).every(x => x.fits === false), "no plan, nothing marked");
});

test("far away or no position: no routes, only the loop from here", () => {
  assert.deepEqual(R.nearbyRoutes(HAMBURG, 5), []);
  assert.deepEqual(R.nearbyRoutes(null, 5), []);
  assert.deepEqual(R.nearbyRoutes({ lat: 999, lon: 0 }, 5), []);
});

/* ---------- B: loop from here ---------- */
test("loop length: 2–30 km, rounded to half kilometres", () => {
  assert.deepEqual(R.validLoopKm("8"), { ok: true, km: 8 });
  assert.deepEqual(R.validLoopKm("7,3"), { ok: true, km: 7.5 });
  assert.equal(R.validLoopKm("1").ok, false);
  assert.equal(R.validLoopKm("31").ok, false);
  assert.equal(R.validLoopKm("abc").ok, false);
});

const LOOP = [[-9.326, 38.678], [-9.320, 38.680], [-9.315, 38.684], [-9.318, 38.690], [-9.325, 38.688], [-9.330, 38.683], [-9.326, 38.678]];

test("Google Maps link: walking, back to the start, up to 8 stops", () => {
  const u = new URL(R.loopMapsUrl(LOOP));
  assert.equal(u.origin + u.pathname, "https://www.google.com/maps/dir/");
  assert.equal(u.searchParams.get("travelmode"), "walking");
  assert.equal(u.searchParams.get("origin"), "38.67800,-9.32600");
  assert.equal(u.searchParams.get("destination"), u.searchParams.get("origin"));
  assert.ok(u.searchParams.get("waypoints").split("|").length <= 8);
  assert.equal(R.loopMapsUrl([]), "");
});

test("shape of the loop fits the box", () => {
  const s = R.loopSvg(LOOP, 300, 180, 10);
  assert.match(s.d, /^M[\d. ]+(L[\d. ]+)+$/);
  const nums = s.d.replace(/[ML]/g, " ").trim().split(/\s+/).map(Number);
  for (let i = 0; i < nums.length; i += 2) { assert.ok(nums[i] >= 9.9 && nums[i] <= 290.1); assert.ok(nums[i + 1] >= 9.9 && nums[i + 1] <= 170.1); }
  assert.deepEqual([s.start.x, s.start.y], nums.slice(0, 2));
  assert.equal(R.loopSvg([[0, 0]], 300, 180), null);
});

/* ---------- server side: netlify/functions/route.mjs ---------- */
async function withFn(fake, fn, key = "ors-key") {
  const { default: handler } = await import("../netlify/functions/route.mjs");
  const realFetch = global.fetch, calls = [];
  if (key) process.env.ORS_API_KEY = key; else delete process.env.ORS_API_KEY;
  global.fetch = async (url, init) => { calls.push({ url: String(url), init }); const [status, body] = fake(); return new Response(JSON.stringify(body), { status }); };
  const call = async (body, method = "POST") => {
    const res = await handler(new Request("https://x/.netlify/functions/route", method === "GET" ? {} : { method, body: typeof body === "string" ? body : JSON.stringify(body) }));
    return { status: res.status, body: await res.json() };
  };
  try { await fn(call, calls); } finally { global.fetch = realFetch; delete process.env.ORS_API_KEY; }
}
const many = Array.from({ length: 1500 }, (_, i) => [-9.326 + Math.sin(i / 240) * 0.01, 38.678 + (1 - Math.cos(i / 240)) * 0.01]);

test("function: asks for a round trip of the right length and returns a light line", async () => {
  await withFn(() => [200, { features: [{ geometry: { coordinates: many }, properties: { summary: { distance: 8123 } } }] }], async (call, calls) => {
    const r = await call({ lat: 38.678, lon: -9.326, km: 8, seed: 3 });
    assert.equal(r.status, 200);
    assert.equal(r.body.km, 8.12);
    assert.ok(r.body.coords.length <= 401);
    assert.deepEqual(r.body.coords[0], [-9.326, 38.678]);
    const sent = JSON.parse(calls[0].init.body);
    assert.deepEqual(sent.coordinates, [[-9.326, 38.678]]);
    assert.deepEqual(sent.options.round_trip, { length: 8000, points: 4, seed: 3 });
    assert.equal(calls[0].init.headers.Authorization, "ors-key");
  });
});

test("function: bad input is refused without asking the route service", async () => {
  await withFn(() => { throw new Error("must not be called"); }, async (call) => {
    assert.equal((await call({ lat: 100, lon: 0, km: 5 })).status, 400);
    assert.equal((await call({ lat: 38, lon: -9, km: 1 })).status, 400);
    assert.equal((await call({ lat: 38, lon: -9, km: 50 })).status, 400);
    assert.equal((await call({ lat: 38, lon: -9, km: 5, seed: 0.5 })).status, 400);
    assert.equal((await call("nope")).status, 400);
    assert.equal((await call({}, "PUT")).status, 405);
  });
});

test("function: no paths nearby, rate limit, not set up", async () => {
  await withFn(() => [404, { error: { code: 2010 } }], async (call) => {
    assert.deepEqual(await call({ lat: 38.6, lon: -9.4, km: 5 }), { status: 404, body: { error: "no_route" } });
  });
  await withFn(() => [429, {}], async (call) => { assert.equal((await call({ lat: 38.6, lon: -9.3, km: 5 })).status, 429); });
  await withFn(() => [200, {}], async (call) => {
    assert.equal((await call(null, "GET")).status, 503);
  }, null);
  await withFn(() => [200, {}], async (call) => {
    assert.deepEqual(await call(null, "GET"), { status: 200, body: { ok: true } });
  });
});
