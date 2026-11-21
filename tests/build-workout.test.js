const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../app/plan.js");

const KNOWN = new Set(["bench", "row", "squat"]);
const known = id => KNOWN.has(id);

test("a name and one known exercise is enough", () => {
  assert.deepEqual(P.validateBuild({ name: "  My   Push Day ", ex: ["bench"] }, known), { ok: true, name: "My Push Day", ex: ["bench"] });
});

test("missing name and no exercises give one message per field", () => {
  const r = P.validateBuild({ name: " ", ex: [] }, known);
  assert.equal(r.ok, false);
  assert.equal(r.errors.name, "Give your workout a name");
  assert.equal(r.errors.ex, "Add at least one exercise");
});

test("names over the limit are refused", () => {
  const r = P.validateBuild({ name: "x".repeat(P.OWN_NAME_MAX + 1), ex: ["bench"] }, known);
  assert.match(r.errors.name, /At most/);
});

test("unknown ids and duplicates are dropped, too many exercises are refused", () => {
  assert.deepEqual(P.validateBuild({ name: "A", ex: ["bench", "nope", "bench", 3] }, known).ex, ["bench"]);
  const many = Array.from({ length: P.OWN_MAX_EX + 1 }, (_, i) => "e" + i);
  assert.match(P.validateBuild({ name: "A", ex: many }).errors.ex, /At most/);
});

const PLAN = { name: "W", sessions: [{ day: 0, kind: "s", workout: "oben", title: "Upper Body" }, { day: 2, kind: "r", title: "Easy run" }, { day: 4, kind: "s", workout: "loB", title: "Lower Body B" }] };

test("placing a workout replaces that strength day only", () => {
  const out = P.placeInPlan(PLAN, 4, "my1", "My Push Day");
  assert.deepEqual(out.sessions[2], { day: 4, kind: "s", workout: "my1", title: "My Push Day" });
  assert.deepEqual(out.sessions[0], PLAN.sessions[0]);
  assert.equal(PLAN.sessions[2].workout, "loB", "original plan unchanged");
});

test("a run day or an empty day leaves the plan as it is", () => {
  assert.deepEqual(P.placeInPlan(PLAN, 2, "my1", "X"), PLAN);
  assert.deepEqual(P.placeInPlan(PLAN, 6, "my1", "X"), PLAN);
  assert.equal(P.placeInPlan(null, 0, "my1", "X"), null);
});
