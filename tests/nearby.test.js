// Tests for "Runs near you": the hand-picked routes in app/run.js · run with: node --test
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

test("at most 4 routes", () => {
  assert.ok(R.NEARBY_ROUTES.length <= 4);
  assert.equal(R.MAX_SUGGESTIONS, 4);
  assert.ok(R.nearbyRoutes(NOVA, 0).length <= 4);
  assert.equal(R.nearbyRoutes(NOVA, 0, 2).length, 2);
  assert.ok(R.nearbyRoutes(NOVA, 0, 99).length <= 4);
});

test("routes that fit the next run of the plan are marked", () => {
  const r = R.nearbyRoutes(NOVA, 5);
  assert.equal(r.find(x => x.id === "carcavelos").fits, true);    // 5 km
  assert.equal(r.find(x => x.id === "belem").fits, false);         // 7 km
  assert.ok(R.nearbyRoutes(NOVA, 0).every(x => x.fits === false), "no plan, nothing marked");
});

test("far away or no position: no routes", () => {
  assert.deepEqual(R.nearbyRoutes(HAMBURG, 5), []);
  assert.deepEqual(R.nearbyRoutes(null, 5), []);
  assert.deepEqual(R.nearbyRoutes({ lat: 999, lon: 0 }, 5), []);
});
