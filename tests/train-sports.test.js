const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../app/plan.js");

const PLAN = { sessions: [{ day: 0, kind: "s" }, { day: 2, kind: "r" }, { day: 4, kind: "s" }] };

test("without a choice Train shows the sports in the plan", () => {
  assert.deepEqual(P.trainKinds(PLAN, null), ["s", "r"]);
});

test("without a plan Train shows all three", () => {
  assert.deepEqual(P.trainKinds(null, null), ["s", "r", "y"]);
  assert.deepEqual(P.trainKinds({ sessions: [] }, undefined), ["s", "r", "y"]);
});

test("a choice wins, always in the order gym, run, yoga, unknown values ignored", () => {
  assert.deepEqual(P.trainKinds(PLAN, ["y", "s", "x"]), ["s", "y"]);
  assert.deepEqual(P.trainKinds(PLAN, ["x"]), ["s", "r"], "a choice with nothing valid falls back to the plan");
});

test("switching sports on and off keeps the order", () => {
  assert.deepEqual(P.toggleKind(["s", "r"], "y"), { ok: true, kinds: ["s", "r", "y"] });
  assert.deepEqual(P.toggleKind(["s", "r", "y"], "r"), { ok: true, kinds: ["s", "y"] });
  assert.deepEqual(P.toggleKind(["r"], "s"), { ok: true, kinds: ["s", "r"] });
});

test("the last sport can't be switched off", () => {
  const r = P.toggleKind(["r"], "r");
  assert.equal(r.ok, false);
  assert.deepEqual(r.kinds, ["r"]);
  assert.match(r.error, /at least one/);
});
